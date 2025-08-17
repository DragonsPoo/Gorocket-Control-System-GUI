import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  SequenceConfig,
  Valve,
  AppConfig,
  SequenceCondition,
  SensorData,
} from '@shared/types';
import type { SerialCommand } from '@shared/types/ipc';
import { getSleepMs, sleep } from '@shared/utils/sleep';

interface SequenceStep {
  message: string;
  delay: number;
  action?: () => Promise<boolean>;
}

export interface SequenceManagerApi {
  sequenceLogs: string[];
  activeSequence: string | null;
  handleSequence: (sequenceName: string) => void;
  addLog: (message: string) => void;
  cancelSequence: () => void;
  sequences: string[];
  sequencesValid: boolean;
}

interface UseSequenceManagerOptions {
  valves: Valve[];
  appConfig: AppConfig | null;
  sendCommand: (cmd: SerialCommand) => Promise<boolean>;
  getSensorData: () => SensorData | null;
  onSequenceComplete?: (name: string) => void;
}

const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new Error('aborted'));
    });
  });

export function useSequenceManager({
  valves,
  appConfig,
  sendCommand,
  getSensorData,
  onSequenceComplete,
}: UseSequenceManagerOptions): SequenceManagerApi {
  const { toast } = useToast();
  const [sequenceLogs, setSequenceLogs] = useState<string[]>(['Awaiting sequence data...']);
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const [sequences, setSequences] = useState<SequenceConfig>({});
  const [sequencesValid, setSequencesValid] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const valvesRef = useRef(valves);
  useEffect(() => {
    valvesRef.current = valves;
  }, [valves]);
  const emergencyRef = useRef(false);
  const emergencyRunningRef = useRef(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSequenceLogs((prev) => {
      const next = [...prev, `[${timestamp}] ${message}`];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const triggerEmergency = useCallback(() => {
    if (emergencyRef.current || emergencyRunningRef.current) {
      addLog('Emergency already triggered or in progress - ignoring duplicate trigger');
      return;
    }

    emergencyRef.current = true;
    const timestamp = new Date().toISOString();
    addLog(`🚨 EMERGENCY TRIGGERED at ${timestamp}`);
    addLog('Aborting all active sequences...');

    // 현재 실행 중인 시퀀스 중단
    controllerRef.current?.abort();

    // 비상 상태 리셋 지연 (중단 증상 방지)
    setTimeout(() => {
      if (!emergencyRunningRef.current) {
        emergencyRef.current = false;
        addLog('Emergency state reset (no emergency sequence running)');
      }
    }, 3000); // 2초에서 3초로 연장
  }, [addLog]);

  function resolveCommand(raw: string): string {
    if (raw.startsWith('V,')) return raw;
    if (raw.startsWith('CMD,')) {
      const [, name, act] = raw.split(',');
      const v = valvesRef.current.find((x) => x.name === name);
      if (!v) throw new Error(`Unknown valve name: ${name}`);
      const vAny = v as unknown as { servoIndex?: number };
      const idx =
        appConfig?.valveMappings[name]?.servoIndex ??
        vAny.servoIndex ??
        v.id - 1;
      return `V,${idx},${/^open$/i.test(act) ? 'O' : 'C'}`;
    }
    return raw;
  }

  // Load sequences on mount
  useEffect(() => {
    const loadSequences = async () => {
      try {
        const result = await window.electronAPI.getSequences();
        setSequences(result.sequences || {});
        setSequencesValid(result.result?.valid ?? false);
        addLog(`Loaded ${Object.keys(result.sequences || {}).length} sequences`);
      } catch (err) {
        addLog(`Failed to load sequences: ${err instanceof Error ? err.message : String(err)}`);
        setSequencesValid(false);
      }
    };
    loadSequences();
  }, [addLog]);

  useEffect(() => {
    const offP = window.electronAPI.onSequenceProgress(e => addLog(`Progress: Step #${e.stepIndex + 1} - ${e.note ?? ''}`));
    const offE = window.electronAPI.onSequenceError(e => { addLog(`ERROR: ${e.error}`); setActiveSequence(null); });
    const offC = window.electronAPI.onSequenceComplete(e => { addLog(`Sequence ${e.name} complete`); setActiveSequence(null); onSequenceComplete?.(e.name); });
    return () => { offP(); offE(); offC(); };
  }, [addLog, onSequenceComplete]);

  const waitForValveFeedback = useCallback(
    (valveIndex: number, targetState: 'OPEN' | 'CLOSED', controller: AbortController) => {
      return new Promise<void>((res, rej) => {
        const timeoutMs = appConfig?.valveFeedbackTimeout ?? 0;

        // 타임아웃이 비활성화된 경우 즉시 반환
        if (timeoutMs <= 0) {
          addLog(`Valve feedback timeout disabled - proceeding without confirmation`);
          res();
          return;
        }

        let checkCount = 0;
        const maxChecks = Math.ceil(timeoutMs / 100);

        const timeout = setTimeout(() => {
          clearInterval(t);
          addLog(`Valve ${valveIndex} feedback timeout after ${timeoutMs}ms - state may be uncertain`);
          rej(new Error(`valve-timeout: Valve ${valveIndex} did not reach ${targetState} within ${timeoutMs}ms`));
        }, timeoutMs);

        const t = setInterval(() => {
          checkCount++;
          const valve = valvesRef.current.find((v) => v.id === valveIndex + 1);

          if (!valve) {
            clearTimeout(timeout);
            clearInterval(t);
            rej(new Error(`valve-not-found: Valve ${valveIndex} not found in system`));
            return;
          }

          const ok = targetState === 'OPEN' ? valve.lsOpen : valve.lsClosed;
          if (ok) {
            clearTimeout(timeout);
            clearInterval(t);
            addLog(`Valve ${valveIndex} confirmed ${targetState} after ${checkCount * 100}ms`);
            res();
          } else if (checkCount >= maxChecks / 2) {
            // 중간 지점에서 경고 로그
            addLog(`Valve ${valveIndex} still waiting for ${targetState} confirmation (${checkCount * 100}ms elapsed)`);
          }
        }, 100);

        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          clearInterval(t);
          rej(new Error('aborted'));
        });
      });
    },
    [appConfig, addLog]
  );

  const waitForSensorCondition = useCallback(
    (cond: SequenceCondition, controller: AbortController) => {
      return new Promise<void>((res, rej) => {
        const start = Date.now();
        const timeoutMs = cond.timeoutMs ?? 30000;
        const op = cond.op ?? 'gte';
        let lastLoggedValue: number | null = null;
        let consecutiveReads = 0;
        let sensorNotFoundCount = 0;

        const t = setInterval(() => {
          const sensorData = getSensorData();
          const v = sensorData?.[cond.sensor as keyof SensorData];

          if (typeof v !== 'number') {
            sensorNotFoundCount++;
            if (sensorNotFoundCount >= 10) { // 1초 후에도 센서 데이터 없음
              clearInterval(t);
              return rej(new Error(`sensor-not-found: Sensor '${cond.sensor}' data not available after 1 second`));
            }
            return;
          }

          sensorNotFoundCount = 0; // 센서 데이터 발견 시 리셋
          consecutiveReads++;

          // 주기적 진행 상황 로깅
          if (lastLoggedValue === null || Math.abs(v - lastLoggedValue) > 0.1 || consecutiveReads % 50 === 0) {
            const elapsed = Date.now() - start;
            addLog(`Sensor ${cond.sensor}: ${v.toFixed(2)} (target: ${op} ${cond.min}, elapsed: ${elapsed}ms)`);
            lastLoggedValue = v;
          }

          // 최대값 초과 검사
          if (cond.max != null && v > cond.max) {
            clearInterval(t);
            return rej(new Error(`condition-exceeded: Sensor ${cond.sensor} value ${v} exceeded maximum ${cond.max}`));
          }

          // 조건 만족 검사
          const ok = op === 'lte' ? v <= cond.min : v >= cond.min;
          if (ok) {
            clearInterval(t);
            const elapsed = Date.now() - start;
            addLog(`Sensor condition met: ${cond.sensor} reached ${v.toFixed(2)} after ${elapsed}ms`);
            res();
          }

          // 타임아웃 검사
          const elapsed = Date.now() - start;
          if (elapsed > timeoutMs) {
            clearInterval(t);
            rej(new Error(`condition-timeout: Sensor ${cond.sensor} did not reach ${cond.min} within ${timeoutMs}ms (current: ${v.toFixed(2)})`));
          }
        }, 100);

        controller.signal.addEventListener('abort', () => {
          clearInterval(t);
          rej(new Error('aborted'));
        });
      });
    },
    [getSensorData, addLog]
  );

  const runSequence = useCallback(
    async (name: string, steps: SequenceStep[], controller: AbortController) => {
      setActiveSequence(name);
      setSequenceLogs([]);
      addLog(`Initiating sequence: ${name}`);
      try {
        for (const step of steps) {
          if (controller.signal.aborted) throw new Error('aborted');
          await delay(step.delay, controller.signal);
          addLog(step.message);
          const result = await step.action?.();
          if (result === false) {
            addLog('Action failed. Aborting sequence.');
            throw new Error('Action failed');
          }
        }
        addLog(`Sequence ${name} complete.`);
      } catch {
        if (!controller.signal.aborted) {
          addLog(`Sequence ${name} failed.`);
        } else {
          addLog(`Sequence ${name} aborted.`);
        }
      } finally {
        setActiveSequence(null);
        if (name === 'Emergency Shutdown') {
          emergencyRunningRef.current = false;
          emergencyRef.current = false; // 비상 셧다운 완료 시 비상 상태 리셋
          addLog('🛡️ Emergency shutdown completed - system returned to safe state');
          addLog('Emergency state cleared - normal operations can resume');
        }
        onSequenceComplete?.(name);
      }
    },
    [addLog, onSequenceComplete]
  );

  const handleSequence = useCallback((name: string) => {
    setSequenceLogs([]);
    setActiveSequence(name);
    window.electronAPI.sequenceStart(name).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Sequence start failed: ${msg}`);
      setActiveSequence(null);
    });
  }, [addLog]);

  const cancelSequence = useCallback(() => {
    window.electronAPI.sequenceCancel().catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Sequence cancel failed: ${msg}`);
    });
  }, [addLog]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return {
    sequenceLogs,
    activeSequence,
    handleSequence,
    addLog,
    cancelSequence,
    sequences: Object.keys(sequences),
    sequencesValid,
  };
}
