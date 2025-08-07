import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SequenceStep {
  message: string;
  delay: number;
  action?: () => void | Promise<void>;
}

export interface SequenceManagerApi {
  sequenceLogs: string[];
  activeSequence: string | null;
  handleSequence: (sequenceName: string) => void;
  addLog: (message: string) => void;
  cancelSequence: () => void;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new Error('aborted'));
    });
  });
}

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
    async (name: string, steps: SequenceStep[]) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setActiveSequence(name);
      setSequenceLogs([]);
      addLog(`Initiating sequence: ${name}`);
      try {
        for (const [index, step] of steps.entries()) {
          await wait(step.delay, controller.signal);
          addLog(step.message);
          if (controller.signal.aborted) throw new Error('aborted');
          await step.action?.();
          if (index === steps.length - 1) {
            addLog(`Sequence ${name} complete.`);
          }
        }
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

      switch (sequenceName) {
        case 'Ignition Sequence':
          runSequence('Ignition Sequence', [
            {
              message: 'Sending command: IGNITION_SEQUENCE_START',
              delay: 500,
              action: () => sendCommand('SEQ_IGNITION_START'),
            },
          ]);
          break;
        case 'Emergency Shutdown':
          runSequence('Emergency Shutdown', [
            {
              message: 'Sending command: EMERGENCY_SHUTDOWN',
              delay: 100,
              action: () => sendCommand('SEQ_SHUTDOWN'),
            },
          ]);
          break;
        default:
          runSequence(sequenceName, [
            {
              message: `Running diagnostics for ${sequenceName}...`,
              delay: 1000,
              action: () =>
                sendCommand(`DIAG_${sequenceName.toUpperCase().replace(' ', '_')}`),
            },
            { message: 'Diagnostics complete.', delay: 2000 },
          ]);
          break;
      }
    },
    [activeSequence, runSequence, sendCommand, toast]
  );

  const cancelSequence = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { sequenceLogs, activeSequence, handleSequence, addLog, cancelSequence };
}
