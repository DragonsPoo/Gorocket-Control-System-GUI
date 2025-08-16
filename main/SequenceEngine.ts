import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import type { SerialManager } from './SerialManager';
import type { SequenceDataManager } from './SequenceDataManager';
import type { ConfigManager } from './ConfigManager';

// 시퀀스/스텝 타입(시퀀스 JSON 구조에 맞춰 확장 가능)
type Condition =
  | { kind: 'ls'; index: number; state: 'open' | 'closed' }
  | { kind: 'pressure'; sensor: number; op: '<' | '<=' | '>' | '>='; valuePsi100: number };

type StepCmd = {
  type: 'cmd';
  payload: string;           // 예) "V,0,O"
  ackTimeoutMs?: number;     // 기본 1000
  feedback?: {               // 옵션: 서보 리미트 스위치 피드백
    valveIndex: number;
    expect: 'open' | 'closed';
    timeoutMs?: number;      // 기본 5000
    pollMs?: number;         // 기본 50
  };
};

type StepWait = {
  type: 'wait';
  condition: Condition;
  timeoutMs: number;         // 필수
  pollMs?: number;           // 기본 50
};

type StepDelay = {
  type: 'delay';
  ms: number;
};

type SequenceStep = StepCmd | StepWait | StepDelay;
type SequenceMap = Record<string, SequenceStep[] | any[]>;

type EngineOptions = {
  hbIntervalMs?: number;
  defaultAckTimeoutMs?: number;
  defaultFeedbackTimeoutMs?: number;
  defaultPollMs?: number;
  autoCancelOnRendererGone?: boolean;
  failSafeOnError?: boolean;
  valveRoles?: { mains: number[]; vent: number; purge: number }; // 페일세이프용
};

type ProgressEvt = { name: string; stepIndex: number; step: SequenceStep; note?: string };
type ErrorEvt = { name: string; stepIndex: number; step?: SequenceStep; error: string };

export class SequenceEngine extends EventEmitter {
  private serial: SerialManager;
  private seqMgr: SequenceDataManager;
  private cfg: ConfigManager | null;
  private getWindow: () => BrowserWindow | null;

  private running = false;
  private cancelled = false;
  private currentName = '';
  private currentIndex = -1;

  private hbTimer: NodeJS.Timeout | null = null;
  private hbIntervalMs: number;
  private defaultAckTimeoutMs: number;
  private defaultFeedbackTimeoutMs: number;
  private defaultPollMs: number;
  private autoCancelOnRendererGone: boolean;
  private failSafeOnError: boolean;
  private roles: { mains: number[]; vent: number; purge: number };

  // 센서 스냅샷
  private psi100: number[] = [0, 0, 0, 0];
  private lsOpen: number[] = [0, 0, 0, 0, 0, 0, 0];
  private lsClosed: number[] = [0, 0, 0, 0, 0, 0, 0];

  // ACK/NACK 대기
  private nextMsgId = 1;
  private pending = new Map<number, { resolve: () => void; reject: (e: any) => void; timer: NodeJS.Timeout; payload: string }>();

  constructor(params: {
    serialManager: SerialManager;
    sequenceManager: SequenceDataManager;
    configManager?: ConfigManager | null;
    getWindow: () => BrowserWindow | null;
    options?: EngineOptions;
  }) {
    super();
    this.serial = params.serialManager;
    this.seqMgr = params.sequenceManager;
    this.cfg = params.configManager ?? null;
    this.getWindow = params.getWindow;

    const opt = params.options ?? {};
    this.hbIntervalMs = opt.hbIntervalMs ?? 1000;
    this.defaultAckTimeoutMs = opt.defaultAckTimeoutMs ?? 1000;
    this.defaultFeedbackTimeoutMs = opt.defaultFeedbackTimeoutMs ?? 5000;
    this.defaultPollMs = opt.defaultPollMs ?? 50;
    this.autoCancelOnRendererGone = opt.autoCancelOnRendererGone ?? true;
    this.failSafeOnError = opt.failSafeOnError ?? true;
    this.roles = opt.valveRoles ?? { mains: [0, 1, 2, 3, 4], vent: 5, purge: 6 };

    // 시리얼 이벤트 구독
    this.serial.on('data', (d: any) => this.onSerialData(d));
    this.serial.on('error', (err: Error) => this.onSerialError(err));
  }

  // =========== 외부 API ===========
  async start(name: string): Promise<void> {
    if (this.running) throw new Error('Sequence already running');
    const seq = this.getSequence(name);
    if (!seq || seq.length === 0) throw new Error(`Sequence not found or empty: ${name}`);

    // <<< 여기에 추가된 코드
    // Dry-run을 실행하여 동적 위험을 사전에 차단합니다.
    const dryRunResult = this.seqMgr.dryRunSequence(name);
    if (!dryRunResult.ok) {
      // 드라이런 실패 시, 에러를 발생시켜 시퀀스 실행을 막습니다.
      throw new Error(`Dry-run failed: ${dryRunResult.errors.join(' | ')}`);
    }
    // >>> 추가된 코드 끝

    this.running = true;
    this.cancelled = false;
    this.currentName = name;
    this.currentIndex = -1;

    this.startHeartbeat();

    try {
      for (let i = 0; i < seq.length; i++) {
        this.currentIndex = i;
        const step = this.normalizeStep(seq[i]);
        this.emitProgress({ name, stepIndex: i, step, note: 'start' });

        if (this.cancelled) throw new Error('Cancelled');

        switch (step.type) {
          case 'cmd':
            await this.execCmdStep(step);
            break;
          case 'wait':
            await this.execWaitStep(step);
            break;
          case 'delay':
            await this.delay(step.ms);
            break;
          default:
            throw new Error('Unknown step');
        }

        this.emitProgress({ name, stepIndex: i, step, note: 'done' });
      }

      this.emitComplete({ name });
    } catch (err: any) {
      this.emitError({ name, stepIndex: this.currentIndex, step: undefined, error: err?.message ?? String(err) });
      if (this.failSafeOnError) {
        await this.tryFailSafe('ENGINE_ERROR');
      }
      throw err;
    } finally {
      this.stopHeartbeat();
      this.cleanupPending(new Error('Sequence exit'));
      this.running = false;
      this.cancelled = false;
      this.currentName = '';
      this.currentIndex = -1;
    }
  }

  cancel(): void {
    if (!this.running) return;
    this.cancelled = true;
  }

  // 렌더러 강제 종료 시 호출(메인에서 wire)
  onRendererGone(details?: any) {
    if (!this.autoCancelOnRendererGone) return;
    if (this.running) {
      this.emitError({ name: this.currentName, stepIndex: this.currentIndex, error: 'Renderer gone' });
      this.cancel();
      void this.tryFailSafe('RENDERER_GONE');
    }
  }

  // =========== 내부 로직 ===========
  private getSequence(name: string): SequenceStep[] | any[] {
    const all = (this.seqMgr.getSequences?.() ?? {}) as SequenceMap;
    return all[name] ?? [];
  }

  private normalizeStep(raw: any): SequenceStep {
    // 문자열 → cmd 스텝으로 간주
    if (typeof raw === 'string') {
      return { type: 'cmd', payload: raw };
    }
    if (raw && raw.type) {
      // 필드 보정
      if (raw.type === 'cmd') {
        const st = raw as StepCmd;
        st.ackTimeoutMs ??= this.defaultAckTimeoutMs;
        if (st.feedback) {
          st.feedback.timeoutMs ??= this.defaultFeedbackTimeoutMs;
          st.feedback.pollMs ??= this.defaultPollMs;
        }
        return st;
      }
      if (raw.type === 'wait') {
        const st = raw as StepWait;
        st.pollMs ??= this.defaultPollMs;
        return st;
      }
      if (raw.type === 'delay') return raw as StepDelay;
    }
    // 알 수 없는 구조 → 에러
    throw new Error('Invalid step format');
  }

  private async execCmdStep(step: StepCmd) {
    await this.sendWithAck(step.payload, step.ackTimeoutMs ?? this.defaultAckTimeoutMs);
    if (step.feedback) {
      await this.waitForValveLS(step.feedback.valveIndex, step.feedback.expect, step.feedback.timeoutMs!, step.feedback.pollMs!);
    }
  }

  private async execWaitStep(step: StepWait) {
    const deadline = Date.now() + step.timeoutMs;
    while (Date.now() < deadline) {
      if (this.cancelled) throw new Error('Cancelled');
      if (this.evalCondition(step.condition)) return;
      await this.delay(step.pollMs ?? this.defaultPollMs);
    }
    throw new Error('Wait timeout');
  }

  private evalCondition(c: Condition): boolean {
    if (c.kind === 'ls') {
      return c.state === 'open' ? this.lsOpen[c.index] === 1 : this.lsClosed[c.index] === 1;
    }
    if (c.kind === 'pressure') {
      const v = this.psi100[c.sensor - 1] ?? 0;
      switch (c.op) {
        case '<': return v < c.valuePsi100;
        case '<=': return v <= c.valuePsi100;
        case '>': return v > c.valuePsi100;
        case '>=': return v >= c.valuePsi100;
      }
    }
    return false;
  }

  private async waitForValveLS(index: number, expect: 'open' | 'closed', timeoutMs: number, pollMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.cancelled) throw new Error('Cancelled');
      const ok = expect === 'open' ? this.lsOpen[index] === 1 : this.lsClosed[index] === 1;
      if (ok) return;
      await this.delay(pollMs);
    }
    throw new Error(`Feedback timeout: V${index} ${expect}`);
  }

  // =========== 시리얼 송수신 ===========
  private hbSending = false;
  private startHeartbeat() {
    if (this.hbTimer) return;
    this.hbSending = true;
    this.hbTimer = setInterval(() => {
      if (!this.hbSending) return;
      // HB는 ACK 대기 없이 송신. NACK이 오면 펌웨어가 이미 비상 진입하므로 에러 처리
      const payload = 'HB';
      const line = this.buildFramed(payload);
      void this.writeLine(line).catch((e) => {
        this.emitError({ name: this.currentName, stepIndex: this.currentIndex, error: `HB send error: ${e?.message ?? e}` });
        void this.tryFailSafe('HB_SEND_ERR');
      });
    }, this.hbIntervalMs);
  }

  private stopHeartbeat() {
    this.hbSending = false;
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = null;
  }

  private async sendWithAck(payload: string, ackTimeoutMs: number) {
    const msgId = this.nextMsgId++;
    const line = this.buildFramed(payload, msgId);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(msgId);
        reject(new Error(`ACK timeout (${ackTimeoutMs} ms) for msgId=${msgId}, payload="${payload}"`));
      }, ackTimeoutMs);
      this.pending.set(msgId, { resolve: () => { clearTimeout(timer); resolve(); }, reject: (e) => { clearTimeout(timer); reject(e); }, timer, payload });
      this.writeLine(line).catch((e) => {
        clearTimeout(timer);
        this.pending.delete(msgId);
        reject(e);
      });
    });
  }

  private buildFramed(payload: string, forcedMsgId?: number): string {
    const msgId = forcedMsgId ?? (this.nextMsgId++);
    const base = `${payload},${msgId}`;
    const crc = this.crc8(Buffer.from(base, 'utf8'));
    const crcHex = crc.toString(16).toUpperCase().padStart(2, '0');
    return `${base},${crcHex}`;
  }

  private async writeLine(line: string): Promise<void> {
    const sm: any = this.serial as any;
    // 사용 가능한 메서드 탐색 (SerialManager 구현에 맞춰 자동 적응)
    if (typeof sm.write === 'function') {
      await sm.write(line + '\n');
    } else if (typeof sm.sendRaw === 'function') {
      await sm.sendRaw(line + '\n');
    } else if (typeof sm.send === 'function') {
      // send가 객체를 받는 경우
      await sm.send({ raw: line + '\n' });
    } else {
      throw new Error('SerialManager has no write-like API');
    }
  }

  private onSerialData(d: any) {
    const line: string =
      typeof d === 'string' ? d :
      (d?.line ?? d?.data ?? d?.toString?.() ?? '');

    if (!line) return;

    // ACK/NACK 처리
    if (line.startsWith('ACK,')) {
      const parts = line.trim().split(',');
      if (parts.length >= 2) {
        const msgId = Number(parts[1]);
        const p = this.pending.get(msgId);
        if (p) {
          this.pending.delete(msgId);
          p.resolve();
        }
      }
      return;
    }
    if (line.startsWith('NACK,')) {
      const parts = line.trim().split(',');
      if (parts.length >= 3) {
        const msgId = Number(parts[1]);
        const reason = parts[2];
        const p = this.pending.get(msgId);
        if (p) {
          this.pending.delete(msgId);
          p.reject(new Error(`NACK(${reason}) for msgId=${msgId} payload="${p.payload}"`));
        } else {
          // HB 등 비대기 패킷에서 CRC 오류 → 즉시 페일세이프
          this.emitError({ name: this.currentName, stepIndex: this.currentIndex, error: `NACK(${reason})` });
          void this.tryFailSafe('NACK');
        }
      }
      return;
    }

    // EMERG 이벤트(펌웨어) 감지 시 즉시 중단
    if (line.startsWith('EMERG,')) {
      this.emitError({ name: this.currentName, stepIndex: this.currentIndex, error: `Firmware emergency: ${line.trim()}` });
      this.cancel();
      // 이미 펌웨어가 비상 시퀀스 수행 중
      return;
    }

    // 텔레메트리 파싱: ptN, Vx_LS_OPEN/CLOSED
    // 예: "pt1:123.45,pt2:...,tc1:...,fm1_m3h:...,V0_LS_OPEN:1,V0_LS_CLOSED:0,..."
    const tokens = line.trim().split(',');
    for (const t of tokens) {
      if (t.startsWith('pt')) {
        // ptN:value
        const [k, v] = t.split(':');
        const m = /^pt(\d+)$/.exec(k);
        if (m && v) {
          const idx = Number(m[1]) - 1;
          const f = Number(v);
          if (!Number.isNaN(f) && idx >= 0 && idx < this.psi100.length) {
            this.psi100[idx] = Math.round(f * 100);
          }
        }
      } else if (t.startsWith('V')) {
        // Vx_LS_OPEN:n or Vx_LS_CLOSED:n
        const [k, v] = t.split(':');
        const m1 = /^V(\d+)_LS_OPEN$/.exec(k);
        const m2 = /^V(\d+)_LS_CLOSED$/.exec(k);
        const n = v !== undefined ? Number(v) : NaN;
        if (m1 && !Number.isNaN(n)) {
          const idx = Number(m1[1]);
          this.lsOpen[idx] = n ? 1 : 0;
        } else if (m2 && !Number.isNaN(n)) {
          const idx = Number(m2[1]);
          this.lsClosed[idx] = n ? 1 : 0;
        }
      }
    }
  }

  private onSerialError(err: Error) {
    this.emitError({ name: this.currentName, stepIndex: this.currentIndex, error: `Serial error: ${err.message}` });
    void this.tryFailSafe('SERIAL_ERR');
  }

  private cleanupPending(reason: Error) {
    for (const [id, p] of this.pending.entries()) {
      clearTimeout(p.timer);
      p.reject(reason);
    }
    this.pending.clear();
  }

  // =========== 페일세이프 ===========
  private async tryFailSafe(tag: string) {
    try {
      // 펌웨어도 HB 타임아웃 비상 시퀀스가 있으나, 즉시 상태 수렴을 위해 명시 명령 보냄
      const cmds: string[] = [];
      // MAIN들 CLOSE
      for (const m of this.roles.mains) cmds.push(`V,${m},C`);
      // VENT/PURGE OPEN
      cmds.push(`V,${this.roles.vent},O`);
      cmds.push(`V,${this.roles.purge},O`);

      for (const c of cmds) {
        // 페일세이프에서는 ACK 타임아웃을 짧게 사용(연쇄 실패를 빠르게 판단)
        await this.sendWithAck(c, 700).catch(() => {/* ignore to continue attempts */});
      }
      this.emitProgress({ name: this.currentName || 'failsafe', stepIndex: -1, step: { type: 'cmd', payload: 'FAILSAFE' } as any, note: tag });
    } catch {
      // ignore
    } finally {
      this.stopHeartbeat();
    }
  }

  // =========== 유틸 ===========
  private delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

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

  private emitProgress(evt: ProgressEvt) {
    this.emit('progress', evt);
    this.getWindow()?.webContents.send('sequence-progress', evt);
  }
  private emitError(evt: ErrorEvt) {
    this.emit('error', evt);
    this.getWindow()?.webContents.send('sequence-error', evt);
  }
  private emitComplete(evt: { name: string }) {
    this.emit('complete', evt);
    this.getWindow()?.webContents.send('sequence-complete', evt);
  }
}
