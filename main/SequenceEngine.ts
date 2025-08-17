import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import type { SerialManager } from './SerialManager';
import type { SequenceDataManager } from './SequenceDataManager';
import type { ConfigManager } from './ConfigManager';
import { getSleepMs, sleep } from '../shared/utils/sleep';

// 시퀀스/스텝 타입(시퀀스 JSON 구조에 맞춰 확장 가능)
type Condition =
  | { kind: 'ls'; index: number; state: 'open' | 'closed' }
  | { kind: 'pressure'; sensor: number; op: '<' | '<=' | '>' | '>='; valuePsi100: number };

type StepCmd = {
  type: 'cmd';
  payload: string;           // 예) "V,0,O"
  ackTimeoutMs?: number;     // 기본 1000
  feedback?: {               // 옵션: 서보 리미트 스위치 피드백
    index: number;           // 밸브 인덱스
    expect: 'open' | 'closed';
    timeoutMs?: number;      // 기본 5000
    pollMs?: number;         // 기본 50
  };
};

type StepWait = {
  type: 'wait';
  condition: Condition;
  timeoutMs: number;
  pollMs?: number;         // 기본 50
};

type SequenceStep = StepCmd | StepWait;

type SequenceMap = Record<string, any[]>;

type EngineOptions = {
  hbIntervalMs?: number;
  defaultAckTimeoutMs?: number;
  defaultFeedbackTimeoutMs?: number;
  defaultPollMs?: number;
  autoCancelOnRendererGone?: boolean;
  failSafeOnError?: boolean;
  valveRoles?: { mains: number[]; vents: number[]; purges: number[] }; // 페일세이프용
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
  private roles: { mains: number[]; vents: number[]; purges: number[] };

  private psi100: number[] = [0, 0, 0, 0];
  private lsOpen: number[] = [0, 0, 0, 0, 0, 0, 0];
  private lsClosed: number[] = [0, 0, 0, 0, 0, 0, 0];

  private pending = new Map<number, { resolve: () => void; reject: (e?: any) => void; timer: NodeJS.Timeout; payload: string }>();
  private nextMsgId = 1;

  constructor(params: {
    serialManager: SerialManager;
    sequenceDataManager: SequenceDataManager;
    configManager?: ConfigManager | null;
    getWindow: () => BrowserWindow | null;
    options?: EngineOptions;
  }) {
    super();
    this.serial = params.serialManager;
    this.seqMgr = params.sequenceDataManager;
    this.cfg = params.configManager ?? null;
    this.getWindow = params.getWindow;

    const opt = params.options ?? {};
    this.hbIntervalMs = opt.hbIntervalMs ?? 1000;
    this.defaultAckTimeoutMs = opt.defaultAckTimeoutMs ?? 1000;
    this.defaultFeedbackTimeoutMs = opt.defaultFeedbackTimeoutMs ?? 5000;
    this.defaultPollMs = opt.defaultPollMs ?? 50;
    this.autoCancelOnRendererGone = opt.autoCancelOnRendererGone ?? true;
    this.failSafeOnError = opt.failSafeOnError ?? true;
    this.roles = opt.valveRoles ?? { mains: [0, 1, 2, 3, 4], vents: [5], purges: [6] };

    // 시리얼 이벤트 구독
    this.serial.on('data', (d: any) => this.onSerialData(d));
    this.serial.on('error', (err: Error) => this.onSerialError(err));
  }

  // =========== 외부 API ===========
  async start(name: string): Promise<void> {
    if (this.running) throw new Error('Sequence already running');
    const raw = this.getSequence(name);
    const seq = Array.isArray(raw) ? this.toSteps(raw) : [];
    if (seq.length === 0) throw new Error(`Sequence not found or empty: ${name}`);

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
          case 'cmd': await this.execCmdStep(step); break;
          case 'wait': await this.execWaitStep(step); break;
          default: throw new Error(`Unknown step type: ${(step as any)?.type}`);
        }

        this.emitProgress({ name, stepIndex: i, step, note: 'done' });
      }

      // 완료
      this.emit('complete', { name });
    } catch (err: any) {
      this.emitError({ name, stepIndex: this.currentIndex, step: seq[this.currentIndex], error: err?.message ?? String(err) });
      if (this.failSafeOnError) {
        await this.tryFailSafe('ENGINE_ERROR');
      }
      throw err;
    } finally {
      this.stopHeartbeat();
      this.cleanupAllPending(new Error('Sequence exit'));
      this.running = false;
      this.cancelled = false;
      this.currentName = '';
      this.currentIndex = -1;
    }
  }

  async cancel() {
    if (!this.running) return;
    this.cancelled = true;
  }

  onRendererGone(details: { reason: string }) {
    if (this.autoCancelOnRendererGone) {
      void this.tryFailSafe('RENDERER_GONE');
      void this.cancel();
    }
  }

  async tryFailSafe(tag = 'FAILSAFE') {
    try {
      const cmds: string[] = [];

      // 메인 닫기
      for (const m of this.roles.mains) cmds.push(`V,${m},C`);
      // 벤트/퍼지 열기
      for (const v of this.roles.vents) cmds.push(`V,${v},O`);
      for (const p of this.roles.purges) cmds.push(`V,${p},O`);

      for (const c of cmds) this.serial.writeNow(c);

      void Promise.allSettled(cmds.map((c) => this.sendWithAck(c, 500))).then((res) => {
        res.forEach((r) => {
          if (r.status === 'rejected') {
            console.error('Failsafe send error', r.reason);
          }
        });
      });
      this.emitProgress({ name: this.currentName || 'failsafe', stepIndex: -1, step: { type: 'cmd', payload: 'FAILSAFE' } as any, note: tag });
    } catch {
      // ignore
    } finally {
      this.stopHeartbeat();
    }
  }

  // =========== 시퀀스 스텝 실행 ===========
  private async execCmdStep(step: StepCmd) {
    const payload = step.payload;
    
    // Check if this is a sleep command
    const sleepMs = getSleepMs(payload);
    if (sleepMs !== null) {
      await sleep(sleepMs);
      return;
    }
    
    const ackMs = step.ackTimeoutMs ?? this.defaultAckTimeoutMs;
    await this.sendWithAck(payload, ackMs);

    // 피드백 요구 시 폴링
    if (step.feedback) {
      const { index, expect, timeoutMs, pollMs } = step.feedback;
      const deadline = Date.now() + (timeoutMs ?? this.defaultFeedbackTimeoutMs);
      const p = pollMs ?? this.defaultPollMs;
      while (Date.now() < deadline) {
        const ok = expect === 'open' ? this.lsOpen[index] === 1 : this.lsClosed[index] === 1;
        if (ok) return;
        await this.delay(p);
      }
      throw new Error(`Feedback timeout: V${index} ${expect}`);
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
        default: return false;
      }
    }
    return false;
  }

  // =========== 시리얼 송수신 ===========
  private hbSending = false;
  private startHeartbeat() {
    if (this.hbIntervalMs <= 0) return;
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
        const id = Number(parts[1]);
        const p = this.pending.get(id);
        if (p) {
          clearTimeout(p.timer);
          p.resolve();
          this.pending.delete(id);
        }
      }
      return;
    }
    if (line.startsWith('NACK,')) {
      const parts = line.trim().split(',');
      if (parts.length >= 3) {
        const id = Number(parts[1]);
        const reason = parts[2];
        const p = this.pending.get(id);
        if (p) {
          clearTimeout(p.timer);
          p.reject(new Error(`NACK: ${reason}`));
          this.pending.delete(id);
        }
      }
      return;
    }

    // 센서/상태 파싱 (간단 구현)
    this.tryParseTelemetry(line);
  }

  private onSerialError(err: Error) {
    this.emitError({ name: this.currentName, stepIndex: this.currentIndex, error: `Serial error: ${err?.message ?? err}` });
  }

  private emitProgress(evt: ProgressEvt) {
    this.emit('progress', evt);
  }
  private emitError(evt: ErrorEvt) {
    this.emit('error', evt);
  }

  private getSequence(name: string): SequenceStep[] | any[] {
    const all = (this.seqMgr.getSequences?.() ?? {}) as SequenceMap;
    return all[name] ?? [];
  }

  private toSteps(rawSteps: any[]): SequenceStep[] {
    const steps: SequenceStep[] = [];
    for (const s of rawSteps) {
      if (typeof s === 'string') { steps.push({ type: 'cmd', payload: s }); continue; }
      if (s && s.type) { steps.push(s as SequenceStep); continue; }

      if (s.delay && s.delay > 0) steps.push({ type: 'wait', timeoutMs: s.delay, condition: { kind: 'time' } as any });

      for (const c of (s.commands ?? [])) steps.push({ type: 'cmd', payload: this.mapCmd(c) });
      if (s.condition) steps.push({ type: 'wait', timeoutMs: s.condition.timeoutMs ?? 30000, condition: this.mapCond(s.condition) });
    }
    return steps;
  }

  private mapCmd(cmd: string): string {
    const mV = /^V,(\d+),(O|C)$/i.exec(cmd); if (mV) return `V,${mV[1]},${mV[2].toUpperCase()}`;
    const mN = /^CMD,([^,]{1,64}),(Open|Close)$/i.exec(cmd);
    if (mN) {
      const name = mN[1]; const act = mN[2].toUpperCase().startsWith('OPEN') ? 'O' : 'C';
      const map = this.cfg?.get()?.valveMappings ?? {}; const idx = map[name]?.servoIndex;
      if (typeof idx !== 'number') throw new Error(`Unknown valve: ${name}`);
      return `V,${idx},${act}`;
    }
    throw new Error(`Unsupported command: ${cmd}`);
  }

  private mapCond(c: any): Condition {
    if (c.sensor && /^pt[1-4]$/i.test(c.sensor)) {
      const i = Number(c.sensor.slice(2));

      const op = String(c.op ?? 'gte').toLowerCase();
      const sign = op === 'lte' ? '<=' : op === 'lt' ? '<' : op === 'gt' ? '>' : '>=';
      const threshold = op === 'lte' || op === 'lt' ? c.max : c.min;
      if (threshold == null) throw new Error(`Missing threshold for ${op} on ${c.sensor}`);
      return { kind: 'pressure', sensor: i, op: sign, valuePsi100: Math.round(threshold * 100) } as any;

    }
    throw new Error(`Unsupported condition: ${JSON.stringify(c)}`);
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
        st.ackTimeoutMs = st.ackTimeoutMs ?? this.defaultAckTimeoutMs;
        if (st.feedback) {
          st.feedback.timeoutMs = st.feedback.timeoutMs ?? this.defaultFeedbackTimeoutMs;
          st.feedback.pollMs = st.feedback.pollMs ?? this.defaultPollMs;
        }
        return st;
      }
      if (raw.type === 'wait') {
        const st = raw as StepWait;
        st.pollMs = st.pollMs ?? this.defaultPollMs;
        return st;
      }
    }
    // 알 수 없으면 cmd로 취급
    return { type: 'cmd', payload: String(raw ?? '') };
  }

  // =========== 텔레메트리 파서(간단) ===========
  private tryParseTelemetry(line: string) {
    // 예시: pt1:1234.56,pt2:...,tc1:...,V0_LS_OPEN:1,V0_LS_CLOSED:0 ...
    // 압력
    const m = /(?:^|,)pt(\d+):(-?\d+(?:\.\d+)?)/g;
    let mm: RegExpExecArray | null;
    while ((mm = m.exec(line)) !== null) {
      const idx = Number(mm[1]) - 1;
      const psi = Math.round(parseFloat(mm[2]) * 100);
      if (idx >= 0 && idx < this.psi100.length && Number.isFinite(psi)) this.psi100[idx] = psi;
    }
    // 리미트 스위치
    const m2 = /(?:^|,)V(\d+)_LS_(OPEN|CLOSED):([01])/g;
    while ((mm = m2.exec(line)) !== null) {
      const idx = Number(mm[1]);
      const which = mm[2] as 'OPEN' | 'CLOSED';
      const bit = Number(mm[3]) as 0 | 1;
      if (which === 'OPEN') this.lsOpen[idx] = bit; else this.lsClosed[idx] = bit;
    }
  }

  // =========== 유틸 ===========
  private delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

  private cleanupAllPending(err: Error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
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
}
