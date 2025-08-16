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

  useEffect(() => {
    const fetchSequences = async () => {
      try {
        const { sequences: loadedSequences, result } = await window.electronAPI.getSequences();
        if (result.valid) {
          // 시퀀스 유효성 검사
          const sequenceNames = Object.keys(loadedSequences);
          const validationErrors: string[] = [];
          
          sequenceNames.forEach(name => {
            const sequence = loadedSequences[name];
            if (!Array.isArray(sequence)) {
              validationErrors.push(`Sequence '${name}' is not an array`);
              return;
            }
            
            sequence.forEach((step, index) => {
              if (!step.message || typeof step.message !== 'string') {
                validationErrors.push(`Sequence '${name}' step ${index}: missing or invalid message`);
              }
              if (typeof step.delay !== 'number' || step.delay < 0) {
                validationErrors.push(`Sequence '${name}' step ${index}: invalid delay (must be non-negative number)`);
              }
              if (!Array.isArray(step.commands)) {
                validationErrors.push(`Sequence '${name}' step ${index}: commands must be an array`);
              }
            });
          });
          
          if (validationErrors.length > 0) {
            const errorMsg = `Sequence validation failed:\n${validationErrors.join('\n')}`;
            setSequences({});
            setSequencesValid(false);
            setSequenceLogs([errorMsg]);
            toast({ title: 'Sequence Validation Error', description: `Found ${validationErrors.length} validation errors`, variant: 'destructive' });
            return;
          }
          
          // 비상 셧다운 시퀀스 필수 검사
          if (!loadedSequences['Emergency Shutdown']) {
            validationErrors.push('Critical: Emergency Shutdown sequence is missing');
          } else {
            const emergencySeq = loadedSequences['Emergency Shutdown'];
            if (emergencySeq.length === 0) {
              validationErrors.push('Critical: Emergency Shutdown sequence is empty');
            }
          }
          
          if (validationErrors.length > 0) {
            const errorMsg = `Critical sequence validation failed:\n${validationErrors.join('\n')}`;
            setSequences({});
            setSequencesValid(false);
            setSequenceLogs([errorMsg]);
            toast({ title: 'Critical Sequence Error', description: 'Emergency Shutdown sequence is invalid', variant: 'destructive' });
            return;
          }
          
          setSequences(loadedSequences);
          setSequencesValid(true);
          setSequenceLogs([`System standby. ${sequenceNames.length} sequences loaded successfully.`]);
          addLog(`Loaded sequences: ${sequenceNames.join(', ')}`);
          toast({ title: 'Sequences Loaded', description: `Successfully loaded ${sequenceNames.length} sequences.` });
        } else {
          setSequences({});
          setSequencesValid(false);
          const errorMsg = `Sequence file error: ${result.errors ?? 'Unknown error'}`;
          setSequenceLogs([errorMsg, 'Please check sequences.json file format and syntax.']);
          toast({ title: 'Sequence File Error', description: errorMsg, variant: 'destructive' });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to load sequences';
        setSequences({});
        setSequencesValid(false);
        setSequenceLogs([`Critical error loading sequences: ${errorMsg}`, 'System cannot operate safely without valid sequences.']);
        toast({ title: 'Critical Error', description: 'Failed to load sequence configuration', variant: 'destructive' });
      }
    };
    void fetchSequences();

    const cleanup = window.electronAPI.onSequencesUpdated(({ sequences: updatedSequences, result }) => {
      try {
        if (result.valid) {
          // 동일한 유효성 검사 적용
          const sequenceNames = Object.keys(updatedSequences);
          const validationErrors: string[] = [];
          
          // 기본 구조 검사
          sequenceNames.forEach(name => {
            const sequence = updatedSequences[name];
            if (!Array.isArray(sequence)) {
              validationErrors.push(`Sequence '${name}' is not an array`);
              return;
            }
            
            sequence.forEach((step, index) => {
              if (!step.message || typeof step.message !== 'string') {
                validationErrors.push(`Sequence '${name}' step ${index}: missing or invalid message`);
              }
              if (typeof step.delay !== 'number' || step.delay < 0) {
                validationErrors.push(`Sequence '${name}' step ${index}: invalid delay`);
              }
              if (!Array.isArray(step.commands)) {
                validationErrors.push(`Sequence '${name}' step ${index}: commands must be an array`);
              }
            });
          });
          
          // 비상 셧다운 필수 검사
          if (!updatedSequences['Emergency Shutdown']) {
            validationErrors.push('Critical: Emergency Shutdown sequence is missing');
          }
          
          if (validationErrors.length > 0) {
            const errorMsg = `Sequence update validation failed: ${validationErrors.join(', ')}`;
            addLog(errorMsg);
            toast({ title: 'Sequence Update Error', description: `Validation failed: ${validationErrors.length} errors`, variant: 'destructive' });
            return;
          }
          
          setSequences(updatedSequences);
          setSequencesValid(true);
          addLog(`Sequence file reloaded successfully. ${sequenceNames.length} sequences available.`);
          toast({ title: 'Sequences Updated', description: `Successfully reloaded ${sequenceNames.length} sequences.` });
        } else {
          setSequences({});
          setSequencesValid(false);
          const errorMsg = `Sequence file update error: ${result.errors ?? 'Unknown error'}`;
          addLog(errorMsg);
          addLog('Reverting to previous sequence configuration for safety.');
          toast({ title: 'Sequence Update Error', description: errorMsg, variant: 'destructive' });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error during sequence update';
        addLog(`Critical error during sequence update: ${errorMsg}`);
        toast({ title: 'Critical Update Error', description: 'Sequence update failed unexpectedly', variant: 'destructive' });
      }
    });

    return cleanup;
  }, [addLog, toast]);

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

  const handleSequence = useCallback(
    (sequenceName: string) => {
      if (!sequencesValid) {
        const errorMsg = 'Cannot run sequence: sequence file is invalid or missing.';
        toast({
          title: 'Sequence Error',
          description: errorMsg,
          variant: 'destructive',
        });
        addLog(`Sequence execution blocked: ${errorMsg}`);
        return;
      }
      
      // 시퀀스 존재 및 유효성 사전 검사
      const sequenceConfig = sequences[sequenceName];
      if (!sequenceConfig) {
        const errorMsg = `The sequence '${sequenceName}' is not defined in sequences.json.`;
        toast({
          title: 'Sequence Not Found',
          description: errorMsg,
          variant: 'destructive',
        });
        addLog(`Sequence execution failed: ${errorMsg}`);
        return;
      }
      
      if (!Array.isArray(sequenceConfig) || sequenceConfig.length === 0) {
        const errorMsg = `Sequence '${sequenceName}' is empty or invalid.`;
        toast({
          title: 'Invalid Sequence',
          description: errorMsg,
          variant: 'destructive',
        });
        addLog(`Sequence execution failed: ${errorMsg}`);
        return;
      }

      // 비상 셧다운 처리 로직 강화
      if (sequenceName === 'Emergency Shutdown') {
        if (emergencyRunningRef.current) {
          addLog('Emergency shutdown already in progress - ignoring duplicate request');
          toast({
            title: 'Emergency In Progress',
            description: 'Emergency shutdown is already running.',
            variant: 'default',
          });
          return;
        }
        
        addLog('🚨 EMERGENCY SHUTDOWN INITIATED');
        addLog('Highest priority sequence - aborting all other operations');
        emergencyRunningRef.current = true;
        
        // 모든 진행 중인 시퀀스 즉시 중단
        controllerRef.current?.abort();
        
        // 비상 셧다운 시간 초과 모니터링
        const emergencyStartTime = Date.now();
        const emergencyTimeout = setTimeout(() => {
          if (emergencyRunningRef.current) {
            addLog('⚠️ WARNING: Emergency shutdown taking longer than expected (>30s)');
            addLog('Manual intervention may be required');
          }
        }, 30000);
        
        // 비상 셧다운 완료 시 타임아웃 정리
        const originalComplete = onSequenceComplete;
        onSequenceComplete = (name) => {
          if (name === 'Emergency Shutdown') {
            clearTimeout(emergencyTimeout);
            const duration = Date.now() - emergencyStartTime;
            addLog(`Emergency shutdown completed in ${duration}ms`);
          }
          originalComplete?.(name);
        };
        
      } else if (activeSequence) {
        const errorMsg = `Cannot start "${sequenceName}" while "${activeSequence}" is running.`;
        toast({
          title: 'Sequence in Progress',
          description: errorMsg,
          variant: 'destructive',
        });
        addLog(`Sequence blocked: ${errorMsg}`);
        return;
      }


      const controller = new AbortController();
      controllerRef.current = controller;

      const steps = sequenceConfig.map((s) => ({
        message: s.message,
        delay: s.delay,
        action: async () => {
          if (s.condition) {
            try {
              const op = s.condition.op ?? 'gte';
              const opText = op === 'lte' ? 'below or equal to' : 'above or equal to';
              addLog(
                `Waiting for ${s.condition.sensor} to be ${opText} ${s.condition.min} (timeout: ${s.condition.timeoutMs ?? 30000}ms)${s.condition.max ? `, max: ${s.condition.max}` : ''}...`
              );
              await waitForSensorCondition(s.condition, controller);
            } catch (error) {
              const errorMsg = (error as Error).message;
              if (errorMsg !== 'aborted') {
                if (errorMsg.includes('condition-timeout')) {
                  addLog(`TIMEOUT: ${errorMsg}`);
                  addLog('Consider increasing timeoutMs in sequence configuration or checking sensor connectivity');
                } else if (errorMsg.includes('condition-exceeded')) {
                  addLog(`CRITICAL: ${errorMsg}`);
                  addLog('Safety limit exceeded - triggering emergency shutdown');
                } else if (errorMsg.includes('sensor-not-found')) {
                  addLog(`SENSOR ERROR: ${errorMsg}`);
                  addLog('Check sensor connections and configuration');
                } else {
                  addLog(`Sensor condition error: ${errorMsg}`);
                }
                
                addLog('Triggering emergency shutdown due to sensor condition failure');
                triggerEmergency();
                if (!emergencyRunningRef.current) {
                  setTimeout(() => handleSequence('Emergency Shutdown'), 100); // 비동기 실행으로 순환 참조 방지
                }
              }
              return false;
            }
          }
          for (const raw of s.commands) {
            if (controller.signal.aborted) throw new Error('aborted');

            const cmdStr = resolveCommand(raw);
            const ok = await sendCommand({ type: 'RAW', payload: cmdStr });

            if (!ok) {
              addLog(`CRITICAL: Command failed to send: ${cmdStr}`);
              addLog('Serial connection lost or command rejected by hardware.');
              
              if (sequenceName === 'Emergency Shutdown') {
                addLog('EMERGENCY: Communication failure during emergency shutdown!');
                addLog('MANUAL INTERVENTION REQUIRED - Check hardware and execute manual shutdown procedures');
              } else {
                addLog('Triggering emergency shutdown due to communication failure');
                triggerEmergency();
                if (!emergencyRunningRef.current) {
                  setTimeout(() => handleSequence('Emergency Shutdown'), 100);
                }
              }
              return false;
            }

            const parts = cmdStr.split(',');
            if (parts[0] === 'V' && parts.length === 3) {
              const valveIndex = parseInt(parts[1], 10);
              const targetState = parts[2] === 'O' ? 'OPEN' : 'CLOSED';
              const timeoutMs = appConfig?.valveFeedbackTimeout ?? 0;
              
              try {
                if (timeoutMs > 0) {
                  addLog(`Waiting for feedback from valve ${valveIndex} (${targetState}) - timeout: ${timeoutMs}ms`);
                } else {
                  addLog(`Valve ${valveIndex} command sent (${targetState}) - feedback disabled`);
                }
                
                await waitForValveFeedback(valveIndex, targetState, controller);
                
                if (timeoutMs > 0) {
                  addLog(`Valve ${valveIndex} feedback confirmed.`);
                }
              } catch (error) {
                const errorMsg = (error as Error).message;
                if (errorMsg !== 'aborted') {
                  if (errorMsg.includes('valve-timeout')) {
                    addLog(`WARNING: Valve ${valveIndex} feedback timeout - continuing sequence but valve state uncertain`);
                    addLog(`Consider checking valve ${valveIndex} manually or enabling longer timeout in config.json`);
                    
                    // 타임아웃에도 시퀀스 계속 (비상 상황에서만 중단)
                    if (sequenceName !== 'Emergency Shutdown') {
                      addLog(`Non-critical timeout in sequence ${sequenceName} - monitoring valve state`);
                    } else {
                      addLog(`Emergency shutdown valve timeout - continuing for safety`);
                    }
                  } else if (errorMsg.includes('valve-not-found')) {
                    addLog(`CRITICAL: ${errorMsg}`);
                    triggerEmergency();
                    if (!emergencyRunningRef.current) {
                      handleSequence('Emergency Shutdown');
                    }
                    return false;
                  } else {
                    addLog(`Valve feedback error: ${errorMsg}`);
                    addLog('Triggering emergency shutdown due to valve feedback error');
                    triggerEmergency();
                    if (!emergencyRunningRef.current) {
                      setTimeout(() => handleSequence('Emergency Shutdown'), 100);
                    }
                    return false;
                  }
                }
              }
            }
          }
          return true;
        },
      }));

      void runSequence(sequenceName, steps, controller);
    },
    [
      sequencesValid,
      activeSequence,
      sequences,
      toast,
      runSequence,
      sendCommand,
      addLog,
      waitForValveFeedback,
      waitForSensorCondition,
      triggerEmergency,
      resolveCommand,
    ]
  );

  const cancelSequence = useCallback(() => {
    if (activeSequence) {
      controllerRef.current?.abort();
    }
  }, [activeSequence]);

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
