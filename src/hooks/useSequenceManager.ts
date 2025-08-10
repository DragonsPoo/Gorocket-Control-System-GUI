import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import sequencesData from '@/sequences.json';

interface SequenceStep {
  message: string;
  delay: number;
  action?: () => void | Promise<void>;
}

interface SequenceConfigStep {
  message: string;
  delay: number;
  command: string;
}

const sequenceConfigs = sequencesData as Record<string, SequenceConfigStep[]>;

export interface SequenceManagerApi {
  sequenceLogs: string[];
  activeSequence: string | null;
  handleSequence: (sequenceName: string) => void;
  addLog: (message: string) => void;
  cancelSequence: () => void;
}

const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new Error('aborted'));
    });
  });

export function useSequenceManager(
  sendCommand: (cmd: string) => Promise<void>
): SequenceManagerApi {
  const { toast } = useToast();
  const [sequenceLogs, setSequenceLogs] = useState<string[]>([
    'System standby. Select a sequence to begin.',
  ]);
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSequenceLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const runSequence = useCallback(
    async (name: string, steps: SequenceStep[], controller: AbortController) => {
      setActiveSequence(name);
      setSequenceLogs([]);
      addLog(`Initiating sequence: ${name}`);
      try {
        for (const step of steps) {
          await delay(step.delay, controller.signal);
          await step.action?.();
          addLog(step.message);
        }
        addLog(`Sequence ${name} complete.`);
      } catch {
        addLog(`Sequence ${name} aborted.`);
      } finally {
        setActiveSequence(null);
      }
    },
    [addLog]
  );

  const handleSequence = useCallback(
    (sequenceName: string) => {
      if (activeSequence) {
        toast({
          title: 'Sequence in Progress',
          description: `Cannot start "${sequenceName}" while "${activeSequence}" is running.`,
          variant: 'destructive',
        });
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const config = sequenceConfigs[sequenceName];
      if (config) {
        const steps = config.map((s) => ({
          message: s.message,
          delay: s.delay,
          action: () => sendCommand(s.command),
        }));
        void runSequence(sequenceName, steps, controller);
      } else {
        void runSequence(
          sequenceName,
          [
            {
              message: `Running diagnostics for ${sequenceName}...`,
              delay: 1000,
              action: () =>
                sendCommand(
                  `DIAG_${sequenceName.toUpperCase().replace(/\s+/g, '_')}`
                ),
            },
            { message: 'Diagnostics complete.', delay: 2000 },
          ],
          controller
        );
      }
    },
    [activeSequence, runSequence, sendCommand, toast]
  );

  const cancelSequence = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  useEffect(() => cancelSequence, [cancelSequence]);

  return { sequenceLogs, activeSequence, handleSequence, addLog, cancelSequence };
}
