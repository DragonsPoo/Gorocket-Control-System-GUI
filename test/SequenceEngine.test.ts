
// test/SequenceEngine.test.ts
import { SequenceEngine } from '../main/SequenceEngine';
import type { SerialManager } from '../main/SerialManager';
import type { SequenceDataManager } from '../main/SequenceDataManager';
import type { ConfigManager } from '../main/ConfigManager';

type Listener = (arg: any) => void;

function createSerialMock() {
  const listeners: Record<string, Listener[]> = {};
  const on = jest.fn((event: string, cb: Listener) => {
    (listeners[event] ||= []).push(cb);
    // Electron/EventEmitter 패턴과 비슷하게 체이닝을 허용
    return serial as any;
  });

  const emit = (event: string, data: any) => {
    for (const cb of listeners[event] || []) cb(data);
  };

  // write 계열 API 중 하나만 있어도 엔진이 자동 탐지합니다.
  const write = jest.fn(async (line: string) => {
    // noop: 테스트에서 필요 시 수동으로 ACK/텔레메트리 주입
  });

  const serial = {
    on,
    write,
  } as unknown as jest.Mocked<SerialManager> & { __emit: typeof emit };

  (serial as any).__emit = emit;
  return serial;
}

function extractMsgIdFromFramed(line: string): number | null {
  // payload,id,crcn  형태. id는 끝에서 두 번째
  const parts = line.trim().split(',');
  if (parts.length < 2) return null;
  const maybeId = parts[parts.length - 2];
  const n = Number(maybeId);
  return Number.isFinite(n) ? n : null;
}

// 짧은 대기 유틸(실제 타이머 사용)
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('SequenceEngine (with real timers)', () => {
  let serial: ReturnType<typeof createSerialMock>;
  let seqMgr: jest.Mocked<SequenceDataManager>;
  let cfgMgr: jest.Mocked<ConfigManager>;
  let engine: SequenceEngine;

  beforeEach(() => {
    jest.useRealTimers();

    serial = createSerialMock();

    // 간단한 시퀀스 맵 제공
    const sequences: Record<string, any[]> = {
      Happy: [
        {
          type: 'cmd',
          payload: 'V,0,O',
          ackTimeoutMs: 50,
          feedback: { index: 0, expect: 'open', timeoutMs: 200, pollMs: 5 },
        },
      ],
      AckTimeout: [
        { type: 'cmd', payload: 'V,1,O', ackTimeoutMs: 30 },
      ],
      WaitTimeout: [
        { type: 'wait', condition: { kind: 'ls', index: 0, state: 'open' }, timeoutMs: 40, pollMs: 5 },
      ],
    };

    seqMgr = {
      getSequences: jest.fn(() => sequences as any),
    } as any;

    cfgMgr = {} as any;

    engine = new SequenceEngine({
      serialManager: serial as any,
      sequenceDataManager: seqMgr as any,
      configManager: cfgMgr as any,
      getWindow: () => null,
      options: {
        hbIntervalMs: 15,
        defaultAckTimeoutMs: 60,
        defaultFeedbackTimeoutMs: 150,
        defaultPollMs: 5,
        failSafeOnError: true,
      },
    });

    // tryFailSafe가 실제 시리얼 전송을 시도하지 않도록 스파이
    jest.spyOn(engine, 'tryFailSafe').mockImplementation(async () => {});
  });

  afterEach(() => {
    // 엔진 내부 보류중 프라미스/타이머 정리
    try {
      (engine as any).cleanupAllPending?.(new Error('test cleanup'));
    } catch {}
    jest.clearAllMocks();
  });

  test('정상 시나리오: cmd ACK + 피드백 open 만족 → complete 이벤트, 에러 없음', async () => {
    // 모든 write에 대해 자동 ACK
    (serial.write as jest.Mock).mockImplementation(async (line: string) => {
      const id = extractMsgIdFromFramed(line);
      // 다음 틱에 ACK (타이머 의존 X)
      queueMicrotask(() => (serial as any).__emit('data', `ACK,${id}`));
    });

    const onComplete = jest.fn();
    const onError = jest.fn();
    engine.on('complete', onComplete);
    engine.on('error', onError);

    const run = engine.start('Happy');

    // 피드백(LS open) 만족
    await wait(25);
    (serial as any).__emit('data', 'V0_LS_OPEN:1');

    await run;

    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(engine.tryFailSafe).not.toHaveBeenCalled();
  });

  test('ACK 타임아웃 → error 이벤트 방출 및 tryFailSafe 호출, Promise reject', async () => {
    // HB 등은 ACK해도 무방하지만, 명령(V,…)은 ACK하지 않음
    (serial.write as jest.Mock).mockImplementation(async (line: string) => {
      const trimmed = line.trim();
      const isHB = trimmed.startsWith('HB,');
      if (isHB) {
        const id = extractMsgIdFromFramed(line);
        queueMicrotask(() => (serial as any).__emit('data', `ACK,${id}`));
      }
      // V,… 는 일부러 무응답
    });

    const onError = jest.fn();
    engine.on('error', onError);

    const run = engine.start('AckTimeout');

    await expect(run).rejects.toThrow(/ACK timeout/i);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(engine.tryFailSafe).toHaveBeenCalledTimes(1);
  });

  test('wait 조건 타임아웃 → error 이벤트 및 tryFailSafe 호출, Promise reject', async () => {
    (serial.write as jest.Mock).mockImplementation(async (line: string) => {
      // 모든 write는 ACK (안전), 단 WaitTimeout 시퀀스엔 cmd가 없음
      const id = extractMsgIdFromFramed(line);
      queueMicrotask(() => (serial as any).__emit('data', `ACK,${id}`));
    });

    const onError = jest.fn();
    engine.on('error', onError);

    const run = engine.start('WaitTimeout');

    await expect(run).rejects.toThrow(/Wait timeout/i);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(engine.tryFailSafe).toHaveBeenCalledTimes(1);
  });
});
