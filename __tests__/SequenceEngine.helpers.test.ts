import { SequenceEngine } from '../main/SequenceEngine';
import { EventEmitter } from 'events';

function createEngine() {
  const serial = new EventEmitter() as any;
  serial.writeNow = jest.fn();
  serial.send = jest.fn().mockResolvedValue(true);
  serial.write = jest.fn().mockResolvedValue(undefined);
  const seqMgr = {} as any;
  const cfg = {
    get: () => ({ valveMappings: { 'Ethanol Main': { servoIndex: 0 } } })
  } as any;
  const engine = new SequenceEngine({
    serialManager: serial,
    sequenceDataManager: seqMgr,
    configManager: cfg,
    getWindow: () => null,
    options: { hbIntervalMs: 0, valveRoles: { mains: [], vents: [], purges: [] } }
  });
  return { engine, serial };
}

describe('SequenceEngine helpers', () => {
  test('mapCmd translates named valve', () => {
    const { engine } = createEngine();
    const result = (engine as any).mapCmd('CMD,Ethanol Main,Open');
    expect(result).toBe('V,0,O');
  });

  test('mapCond parses operators and thresholds', () => {
    const { engine } = createEngine();
    expect((engine as any).mapCond({ sensor: 'pt1', min: 450, op: 'gte' })).toEqual({
      kind: 'pressure',
      sensor: 1,
      op: '>=',
      valuePsi100: 45000
    });
    expect((engine as any).mapCond({ sensor: 'pt2', max: 150, op: 'lt' })).toEqual({
      kind: 'pressure',
      sensor: 2,
      op: '<',
      valuePsi100: 15000
    });
    expect(() => (engine as any).mapCond({ sensor: 'pt3', op: 'gt' })).toThrow('Missing threshold');
  });

  test('toSteps converts raw structure', () => {
    const { engine } = createEngine();
    const raw = [
      {
        delay: 1000,
        commands: ['CMD,Ethanol Main,Open', 'V,2,O'],
        condition: { sensor: 'pt1', min: 450, op: 'gte' }
      }
    ];
    const steps = (engine as any).toSteps(raw);
    expect(steps).toEqual([
      { type: 'wait', timeoutMs: 1000, condition: { kind: 'time' } },
      { type: 'cmd', payload: 'V,0,O' },
      { type: 'cmd', payload: 'V,2,O' },
      {
        type: 'wait',
        timeoutMs: 30000,
        condition: { kind: 'pressure', sensor: 1, op: '>=', valuePsi100: 45000 }
      }
    ]);
  });
});

describe('SequenceEngine failsafe', () => {
  function createEngineWithRoles(roles: { mains: number[]; vents: number[]; purges: number[] }) {
    const serial = new EventEmitter() as any;
    serial.writeNow = jest.fn();
    serial.write = jest.fn().mockResolvedValue(undefined);
    const seqMgr = {} as any;
    const cfg = { get: () => ({}) } as any;
    const engine = new SequenceEngine({
      serialManager: serial,
      sequenceDataManager: seqMgr,
      configManager: cfg,
      getWindow: () => null,
      options: { hbIntervalMs: 0, valveRoles: roles }
    });
    return { engine, serial };
  }

  test('tryFailSafe writes to all unique roles', async () => {
    const { engine, serial } = createEngineWithRoles({ mains: [0, 0, 1], vents: [2, 2], purges: [3, 4, 3] });
    await engine.tryFailSafe();
    await new Promise((r) => setTimeout(r, 600));
    expect(serial.writeNow).toHaveBeenCalledTimes(5);
  });

  test('failsafe reentry is guarded', async () => {
    const { engine, serial } = createEngineWithRoles({ mains: [0], vents: [1], purges: [2] });
    await Promise.all([engine.tryFailSafe(), engine.tryFailSafe()]);
    await new Promise(r => setTimeout(r, 300));
    expect(serial.writeNow).toHaveBeenCalledTimes(3);
  });
});

describe('SequenceEngine wait steps', () => {
  test('execWaitStep handles time kind', async () => {
    const { engine } = createEngine();
    const t0 = Date.now();
    await (engine as any).execWaitStep({ type: 'wait', condition: { kind: 'time' }, timeoutMs: 50 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
  });
});
