import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SequenceConfig, Valve, AppConfig } from '@shared/types';

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
  sendCommand: (cmd: string) => Promise<boolean>;
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
  onSequenceComplete,
}: UseSequenceManagerOptions): SequenceManagerApi {
  const { toast } = useToast();
  const [sequenceLogs, setSequenceLogs] = useState<string[]>(['Awaiting sequence data...']);
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const [sequences, setSequences] = useState<SequenceConfig>({});
  const [sequencesValid, setSequencesValid] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSequenceLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  useEffect(() => {
    const fetchSequences = async () => {
      const { sequences: loadedSequences, result } = await window.electronAPI.getSequences();
      if (result.valid) {
        setSequences(loadedSequences);
        setSequencesValid(true);
        setSequenceLogs(['System standby. Select a sequence to begin.']);
        toast({ title: 'Sequences Loaded', description: 'Successfully loaded sequence file.' });
      } else {
        setSequences({});
        setSequencesValid(false);
        const errorMsg = `Sequence file error: ${result.errors ?? 'Unknown error'}`;
        setSequenceLogs([errorMsg]);
        toast({ title: 'Sequence Error', description: errorMsg, variant: 'destructive' });
      }
    };
    void fetchSequences();

    const cleanup = window.electronAPI.onSequencesUpdated(({ sequences: updatedSequences, result }) => {
      if (result.valid) {
        setSequences(updatedSequences);
        setSequencesValid(true);
        addLog('Sequence file reloaded successfully.');
        toast({ title: 'Sequences Updated', description: 'Successfully reloaded sequence file.' });
      } else {
        setSequences({});
        setSequencesValid(false);
        const errorMsg = `Sequence file error: ${result.errors ?? 'Unknown error'}`;
        addLog(errorMsg);
        toast({ title: 'Sequence Error', description: errorMsg, variant: 'destructive' });
      }
    });

    return cleanup;
  }, [addLog, toast]);

  const waitForValveFeedback = useCallback(
    (valveIndex: number, targetState: 'OPEN' | 'CLOSED', controller: AbortController) => {
      return new Promise<void>((resolve, reject) => {
        if (!appConfig?.valveFeedbackTimeout) {
          addLog('Warning: valveFeedbackTimeout not configured. Skipping feedback check.');
          resolve();
          return;
        }

        const valveId = valveIndex + 1;

        const timeoutId = setTimeout(() => {
          clearInterval(intervalId);
          reject(new Error(`Timeout: Valve ${valveIndex} (${targetState}) did not provide feedback.`));
        }, appConfig.valveFeedbackTimeout);

        const intervalId = setInterval(() => {
          const valve = valves.find((v) => v.id === valveId);
          const feedbackReceived = targetState === 'OPEN' ? valve?.lsOpen : valve?.lsClosed;

          if (feedbackReceived) {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            resolve();
          }
        }, 100); // Check every 100ms

        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          reject(new Error('aborted'));
        });
      });
    },
    [valves, appConfig, addLog]
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
        onSequenceComplete?.(name);
      }
    },
    [addLog, onSequenceComplete]
  );

  const handleSequence = useCallback(
    (sequenceName: string) => {
      if (!sequencesValid) {
        toast({
          title: 'Sequence Error',
          description: 'Cannot run sequence: sequence file is invalid or missing.',
          variant: 'destructive',
        });
        return;
      }

      if (sequenceName === 'Emergency Shutdown' && activeSequence) {
        controllerRef.current?.abort();
      } else if (activeSequence) {
        toast({
          title: 'Sequence in Progress',
          description: `Cannot start "${sequenceName}" while "${activeSequence}" is running.`,
          variant: 'destructive',
        });
        return;
      }

      const sequenceConfig = sequences[sequenceName];
      if (!sequenceConfig) {
        toast({
          title: 'Sequence Not Found',
          description: `The sequence "${sequenceName}" is not defined in sequences.json.`,
          variant: 'destructive',
        });
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      const steps = sequenceConfig.map((s) => ({
        message: s.message,
        delay: s.delay,
        action: async () => {
          for (const cmd of s.commands) {
            if (controller.signal.aborted) throw new Error('aborted');

            const ok = await sendCommand(cmd);
            if (!ok) {
              addLog(`Command failed to send: ${cmd}`);
              return false;
            }

            const parts = cmd.split(',');
            if (parts[0] === 'V' && parts.length === 3) {
              const valveIndex = parseInt(parts[1], 10);
              const targetState = parts[2] === 'O' ? 'OPEN' : 'CLOSED';
              try {
                addLog(`Waiting for feedback from valve ${valveIndex} (${targetState})...`);
                await waitForValveFeedback(valveIndex, targetState, controller);
                addLog(`Feedback received for valve ${valveIndex}.`);
              } catch (error) {
                if ((error as Error).message !== 'aborted') {
                  addLog(`Valve feedback error: ${(error as Error).message}`);
                  handleSequence('Emergency Shutdown');
                }
                return false;
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
