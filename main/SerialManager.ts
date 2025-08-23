import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { EventEmitter } from 'events';
import type { SerialCommand, SerialStatus } from '../shared/types/ipc';
import { ValveCommandType } from '../shared/types/ipc';

export interface SerialManagerEvents {
  data: (data: string) => void;   // 텔레메트리/로그 라인
  error: (error: Error) => void;  // 포트/프로토콜 에러
  status?: (s: SerialStatus) => void; // 선택적
}

export declare interface SerialManager {
  on<U extends keyof SerialManagerEvents>(
    event: U,
    listener: SerialManagerEvents[U]
  ): this;
}

type OutMsg = {
  payload: string;          // ex) "V,0,O" or already-framed line if isFramed=true
  framed: string;           // ex) "V,0,O,42,3A"
  msgId: number;
  attempts: number;
  maxRetries: number;
  ackTimeoutMs: number;
  resolve: (v: boolean) => void;
  reject: (e: Error) => void;
  timer?: NodeJS.Timeout;
  isFramed: boolean;
};

export class SerialManager extends EventEmitter {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private manualClose = false;

  // 신뢰성/큐
  private queue: OutMsg[] = [];
  private inflight: OutMsg | null = null;
  private pendingById = new Map<number, OutMsg>();
  private nextMsgId = 1;

  // 연결/재연결 상태
  private lastPath: string | null = null;
  private lastBaud: number | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = 300;

  // 기본 파라미터
  private DEFAULT_ACK_TIMEOUT = 1500; // ms
  private DEFAULT_RETRIES = 5;        // 총 시도 횟수(초기+재시도)
  private NACK_RETRY_DELAY = 80;      // ms
  private BACKOFF_MAX = 5000;         // ms
  private MAX_QUEUE_LEN = 200;        // 최대 큐 길이 (older commands dropped)

  // BUSY 회피를 위한 송신 페이싱 및 READY 게이트
  private paceMs = 80;                // 최소 명령 간 간격(ms)
  private lastSendAt = 0;             // 마지막 송신 시각
  private mcuReady = true;            // READY/IDLE 신호 수신 시 true

  // ====================== 포트 열기/닫기 ======================
  async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  }

  async connect(path: string, baudRate: number): Promise<boolean> {
    if (this.port?.isOpen) {
      await this.disconnect();
    }

    this.lastPath = path;
    this.lastBaud = baudRate;

    this.manualClose = false;
    let success = false;

    try {
      this.port = new SerialPort({ path, baudRate, autoOpen: true });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

      // open 대기
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup(); reject(new Error('Connection timeout'));
        }, 5000);
        const onOpen = () => { cleanup(); resolve(); };
        const onErr = (e: Error) => { cleanup(); reject(e); };
        const cleanup = () => {
          clearTimeout(timeout);
          this.port?.off('open', onOpen);
          this.port?.off('error', onErr);
        };
        this.port?.once('open', onOpen);
        this.port?.once('error', onErr);
      });

      // 수신 핸들러 구성
      this.port.on('close', () => this.onPortClosed());
      this.port.on('error', (e) => this.onPortError(e));
      this.parser.on('data', (d: string) => this.onLine(d));

      // 헬로 핸드셰이크 (CRC 프레이밍)
      await this.sendHelloHandshake();

      this.reconnectDelayMs = 300;
      this.emitStatus('connected', path);
      success = true;
      return true;
    } catch (err) {
      this.emit('error', err as Error);
      return false;
    } finally {
      if (!success) {
        await this.cleanupPort();
      }
    }
  }

  async disconnect(): Promise<boolean> {
    if (!this.port) return false;
    this.manualClose = true;
    const p = this.port;
    return new Promise((resolve) => {
      p.close((err) => {
        if (err) this.emit('error', err);
        resolve(!err);
        p.removeAllListeners();
        this.parser?.removeAllListeners();
        this.parser = null;
        this.manualClose = false;
      });
      this.port = null;
    });
  }

  // ====================== 신뢰성 전송 API ======================
  async send(command: SerialCommand | { raw: string } | string): Promise<boolean> {
    if (!this.port || !this.port.isOpen) {
      // 연결 안됨 → 재연결 시도
      this.scheduleReconnect();
      return Promise.reject(new Error('Port not open'));
    }

    const { payload, isFramed, msgId: parsedId } = this.buildPayload(command);
    const { framed, msgId } = isFramed
      ? { framed: payload, msgId: parsedId! }
      : this.frame(payload);

    const ackTimeoutMs: number = (command as any)?.ackTimeoutMs ?? this.DEFAULT_ACK_TIMEOUT;
    const maxRetries: number = (command as any)?.retries ?? this.DEFAULT_RETRIES;
    const isHb = payload.toUpperCase() === 'HB';

    return new Promise<boolean>((resolve, reject) => {
      // 혼잡 시 HB는 건너뛰어 BUSY 발생을 줄임
      if (isHb && (this.inflight || this.queue.some(q => q.payload.toUpperCase() !== 'HB'))) {
        return resolve(true);
      }
      const msg: OutMsg = {
        payload, framed, msgId, attempts: 0, maxRetries, ackTimeoutMs,
        resolve, reject, isFramed
      };
      
      // Enforce queue length limit by dropping old general commands
      if (this.queue.length >= this.MAX_QUEUE_LEN) {
        // Remove the oldest general command (not priority commands)
        for (let i = 0; i < this.queue.length; i++) {
          const cmd = this.queue[i];
          if (!this.isPriorityCommand(cmd.payload)) {
            this.queue.splice(i, 1);
            cmd.reject(new Error('Queue overflow - command dropped'));
            break;
          }
        }
      }
      
      this.queue.push(msg);
      this.processQueue();
    });
  }

  writeNow(line: string) {
    if (!this.port?.isOpen) return;
    this.port.write(line.endsWith('\n') ? line : line + '\n', () => {});
  }


  clearQueue() { this.queue.length = 0; }

  abortInflight(reason = 'aborted') {
    const m = this.inflight;
    if (!m) return;
    clearTimeout(m.timer);
    this.pendingById.delete(m.msgId);
    this.inflight = null;
    m.reject(new Error(reason));
  }

  abortAllPendings(reason = 'aborted') {
    for (const [, m] of this.pendingById) {
      clearTimeout(m.timer);
      m.reject(new Error(reason));
    }
    this.pendingById.clear();
  }


  // Check if command is priority (EMERG/FAILSAFE/HB)
  private isPriorityCommand(payload: string): boolean {
    const upper = payload.toUpperCase();
    return upper.startsWith('EMERG') || upper.startsWith('FAILSAFE') || upper === 'HB' || upper === 'SAFE_CLEAR';
  }

  // ====================== 내부 구현 ======================
  private processQueue() {
    if (!this.port || !this.port.isOpen) return;
    if (this.inflight) return;
    // 페이싱/레디 게이트
    const now = Date.now();
    const wait = this.paceMs - (now - this.lastSendAt);
    if (wait > 0 || !this.mcuReady) {
      const delay = Math.max(10, wait > 0 ? wait : 30);
      setTimeout(() => this.processQueue(), delay);
      return;
    }
    const msg = this.queue.shift();
    if (!msg) return;

    // 전송
    this.inflight = msg;
    msg.attempts++;
    this.pendingById.set(msg.msgId, msg);

    this.mcuReady = false;
    this.lastSendAt = Date.now();
    this.port.write(this.ensureLF(msg.framed), (err) => {
      if (err) {
        // write 실패 → 재시도
        this.onWriteError(msg, err);
        return;
      }
      // ACK 타이머
      msg.timer = setTimeout(() => {
        this.onAckTimeout(msg);
      }, msg.ackTimeoutMs);
    });
  }

  private onAckTimeout(msg: OutMsg) {
    // 타임아웃 → 재시도
    this.clearInflightTimer(msg);
    this.pendingById.delete(msg.msgId);
    this.inflight = null;

    if (msg.attempts >= msg.maxRetries) {
      msg.reject(new Error(`ACK timeout after ${msg.attempts} attempts for msgId=${msg.msgId}`));
    } else {
      // 재큐
      setTimeout(() => { this.queue.unshift(msg); this.processQueue(); }, this.NACK_RETRY_DELAY);
    }
  }

  private onWriteError(msg: OutMsg, err: Error) {
    this.clearInflightTimer(msg);
    this.pendingById.delete(msg.msgId);
    this.inflight = null;
    this.emit('error', err);
    // 포트 상태 확인 후 재전송 시도
    if (!this.port || !this.port.isOpen) this.scheduleReconnect();
    if (msg.attempts >= msg.maxRetries) {
      msg.reject(new Error(`Write failed: ${err.message}`));
    } else {
      setTimeout(() => { this.queue.unshift(msg); this.processQueue(); }, this.NACK_RETRY_DELAY);
    }
  }

  private onLine(raw: string) {
    const line = raw.trim();
    if (!line) return;

    // READY/IDLE 신호로 레디 게이트 해제
    if (/^(READY|IDLE)\b/i.test(line)) {
      this.mcuReady = true;
      this.emit('data', line);
      this.processQueue();
      return;
    }

    // Fallback: handle BUSY without msgId (e.g., "NACK BUSY" or "BUSY")
    if (/^(NACK\s*BUSY|BUSY)\b/i.test(line)) {
      const inflight = this.inflight;
      if (inflight) {
        this.pendingById.delete(inflight.msgId);
        this.clearInflightTimer(inflight);
        this.inflight = null;
        // BUSY 수신 시 페이싱 증가(적응형)
        this.paceMs = Math.min(this.paceMs + 40, 1000);
        if (inflight.attempts >= inflight.maxRetries) {
          inflight.reject(new Error(`NACK(BUSY) for msgId=${inflight.msgId}`));
        } else {
          setTimeout(() => { this.queue.unshift(inflight); this.processQueue(); }, this.NACK_RETRY_DELAY);
        }
      }
      // Forward to renderer as data for visibility
      this.emit('data', line);
      return;
    }

    // Fast-path ACK/NACK 처리로 페이싱/레디 제어 강화
    if (/^ACK,\d+/.test(line)) {
      const parts = line.split(',');
      const id = Number(parts[1]);
      const msg = this.pendingById.get(id);
      if (msg) {
        this.pendingById.delete(id);
        this.clearInflightTimer(msg);
        this.inflight = null;
        msg.resolve(true);
        this.paceMs = Math.max(40, Math.floor(this.paceMs * 0.9));
        this.mcuReady = true;
        this.emit('data', line);
        this.processQueue();
        return;
      }
    }
    if (/^NACK,\d+/.test(line)) {
      const parts = line.split(',');
      const id = Number(parts[1]);
      const reason = parts[2] ?? '';
      const msg = this.pendingById.get(id);
      if (msg) {
        this.pendingById.delete(id);
        this.clearInflightTimer(msg);
        this.inflight = null;
        if (/busy/i.test(reason)) {
          this.paceMs = Math.min(this.paceMs + 40, 1000);
          setTimeout(() => { this.queue.unshift(msg); this.processQueue(); }, this.NACK_RETRY_DELAY);
        } else if (msg.attempts >= msg.maxRetries) {
          msg.reject(new Error(`NACK(${reason}) for msgId=${id}`));
        } else {
          setTimeout(() => { this.queue.unshift(msg); this.processQueue(); }, this.NACK_RETRY_DELAY);
        }
        this.emit('data', line);
        return;
      }
    }

    const parsed = this.parseAckNack(line);
    if (parsed) {
      if (parsed.kind === 'ack') {
        const msg = this.pendingById.get(parsed.msgId);
        if (msg) {
          this.pendingById.delete(parsed.msgId);
          this.clearInflightTimer(msg);
          this.inflight = null;
          msg.resolve(true);
          // 다음 처리
          this.processQueue();
        }
      } else if (parsed.kind === 'nack') {
        const msg = this.pendingById.get(parsed.msgId);
        if (msg) {
          this.pendingById.delete(parsed.msgId);
          this.clearInflightTimer(msg);
          this.inflight = null;
          if (msg.attempts >= msg.maxRetries) {
            msg.reject(new Error(`NACK(${parsed.reason}) for msgId=${parsed.msgId}`));
          } else {
            // 재시도
            setTimeout(() => { this.queue.unshift(msg); this.processQueue(); }, this.NACK_RETRY_DELAY);
          }
        } else {
          // 대기 중 아님(예: HB 등) → 알림만
          this.emit('error', new Error(`NACK(${parsed.reason}) for unknown msgId=${parsed.msgId}`));
        }
      }
      // ACK/NACK 라인도 그대로 상위에 보낼지 여부는 정책에 따름.
      // 여기서는 디버그/상호운용을 위해 그대로 data 이벤트로도 흘려보냅니다.
      this.emit('data', line);
      return;
    }

    // 일반 텔레메트리/로그 라인
    this.emit('data', line);
  }

  private async sendHelloHandshake(): Promise<void> {
    // 프레임드 HELLO 송신 후 READY or ACK 대기(둘 중 하나면 성공 처리)
    const { framed, msgId } = this.frame('HELLO');

    await new Promise<void>((resolve, reject) => {
      let done = false;
      const to = setTimeout(() => {
        cleanup(); reject(new Error('Handshake timeout'));
      }, 3000);

      const onData = (d: string) => {
        const line = d.trim();
        if (!line) return;
        if (line === 'READY') { finish(); }
        const ack = this.parseAckNack(line);
        if (ack && ack.kind === 'ack' && ack.msgId === msgId) { finish(); }
      };
      const onErr = (e: Error) => { cleanup(); reject(e); };
      const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
      const cleanup = () => {
        clearTimeout(to);
        this.parser?.off('data', onData);
        this.port?.off('error', onErr);
      };

      this.parser?.on('data', onData);
      this.port?.once('error', onErr);
      this.port?.write(this.ensureLF(framed));
    });
  }

  private onPortClosed() {
    if (this.manualClose) {
      this.emitStatus('disconnected');
      return;
    }
    this.emit('error', new Error('Port closed unexpectedly'));
    // inflight 재큐
    if (this.inflight) {
      const msg = this.inflight;
      this.clearInflightTimer(msg);
      this.pendingById.delete(msg.msgId);
      this.queue.unshift(msg);
      this.inflight = null;
    }
    this.emitStatus('disconnected');
    this.scheduleReconnect();
  }

  private onPortError(err: Error) {
    this.emit('error', err);
    // inflight 보존 후 재연결
    if (!this.port || !this.port.isOpen) this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.manualClose) return;
    if (this.reconnectTimer) return;
    this.emitStatus('reconnecting', this.lastPath ?? undefined);

    const attempt = async () => {
      this.reconnectTimer = null;
      if (!this.lastPath || !this.lastBaud) {
        // 연결 정보 없음
        return;
      }
      const ok = await this.connect(this.lastPath, this.lastBaud);
      if (!ok) {
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.BACKOFF_MAX);
        this.reconnectTimer = setTimeout(attempt, this.reconnectDelayMs);
      } else {
        // 재연결 성공 → 큐 재개
        this.processQueue();
      }
    };
    this.reconnectTimer = setTimeout(attempt, this.reconnectDelayMs);
  }

  private async cleanupPort() {
    try {
      if (this.port) {
        if (this.port.isOpen) {
          await new Promise<void>((res) => this.port!.close(() => res()));
        }
        this.port.removeAllListeners();
      }
    } catch {}
    this.parser?.removeAllListeners();
    this.port = null;
    this.parser = null;
  }

  // ====================== 빌드/프레이밍/파싱 ======================
  private buildPayload(input: SerialCommand | { raw: string } | string): { payload: string; isFramed: boolean; msgId?: number } {
    if (typeof input === 'string') {
      const pl = this.stripLF(input);
      const framed = this.detectFramed(pl);
      return framed ? { payload: pl, isFramed: true, msgId: framed.msgId } : { payload: pl, isFramed: false };
    }
    if ('raw' in input) {
      const pl = this.stripLF(input.raw);
      const framed = this.detectFramed(pl);
      return framed ? { payload: pl, isFramed: true, msgId: framed.msgId } : { payload: pl, isFramed: false };
    }
    // SerialCommand
    switch (input.type) {
      case 'V': {
        const act = input.action === ValveCommandType.OPEN ? 'O' : 'C';
        const pl = `V,${input.servoIndex},${act}`;
        return { payload: pl, isFramed: false };
      }
      case 'RAW': {
        const pl = this.stripLF(input.payload);
        const framed = this.detectFramed(pl);
        return framed ? { payload: pl, isFramed: true, msgId: framed.msgId } : { payload: pl, isFramed: false };
      }
      default:
        throw new Error('Unknown command');
    }
  }

  private frame(payload: string): { framed: string; msgId: number } {
    const msgId = this.nextMsgId++;
    const base = `${payload},${msgId}`;
    const crc = this.crc8(Buffer.from(base, 'utf8'));
    const crcHex = crc.toString(16).toUpperCase().padStart(2, '0');
    return { framed: `${base},${crcHex}`, msgId };
  }

  private detectFramed(line: string): { msgId: number } | null {
    // ...,<msgId>,<crcHex>
    const m = /,(\d+),([A-Fa-f0-9]{2})$/.exec(line);
    if (!m) return null;
    const id = Number(m[1]);
    if (!Number.isFinite(id)) return null;
    return { msgId: id };
    // CRC 검증은 펌웨어/ACK가 보장하므로 여기서 생략
  }

  private parseAckNack(line: string):
    | { kind: 'ack'; msgId: number }
    | { kind: 'nack'; msgId: number; reason: string }
    | null {
    if (line.startsWith('ACK,')) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const id = Number(parts[1]);
        if (Number.isFinite(id)) return { kind: 'ack', msgId: id };
      }
      return null;
    }
    if (line.startsWith('NACK,')) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        const id = Number(parts[1]);
        const reason = parts[2];
        if (Number.isFinite(id)) return { kind: 'nack', msgId: id, reason };
      }
      return null;
    }
    return null;
  }

  private crc8(buf: Uint8Array): number {
    let crc = 0x00;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let b = 0; b < 8; b++) {
        crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
      }
    }
    return crc & 0xFF;
  }

  private stripLF(s: string): string {
    return s.replace(/[\r\n]+$/g, '');
  }
  private ensureLF(s: string): string {
    return s.endsWith('\n') ? s : (s + '\n');
  }
  private clearInflightTimer(msg: OutMsg) {
    if (msg.timer) { clearTimeout(msg.timer); msg.timer = undefined; }
  }
  private emitStatus(state: 'connected' | 'disconnected' | 'reconnecting', path?: string) {
    this.emit('status', { state, path });
  }
}
