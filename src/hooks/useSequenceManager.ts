import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SequenceStep {
  message: string;
  delay: number;
  action?: () => void;
}

export interface SequenceManagerApi {
  sequenceLogs: string[];
  activeSequence: string | null;
  handleSequence: (sequenceName: string) => void;
  addLog: (message: string) => void;
}

export function useSequenceManager(sendCommand: (cmd: string) => void): SequenceManagerApi {
  const { toast } = useToast();
  const [sequenceLogs, setSequenceLogs] = useState<string[]>(['System standby. Select a sequence to begin.']);
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const ignitionPhase = useRef<'idle' | 'igniter' | 'main_stage'>('idle');

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSequenceLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const clearAndRunSequence = useCallback(
    (name: string, steps: SequenceStep[]) => {
      setActiveSequence(name);
      setSequenceLogs([]);
      sequenceTimeoutRef.current.forEach(clearTimeout);
      sequenceTimeoutRef.current = [];

      let cumulativeDelay = 0;
      addLog(`Initiating sequence: ${name}`);

      steps.forEach((step, index) => {
        cumulativeDelay += step.delay;
        const timeout = setTimeout(() => {
          addLog(step.message);
          step.action?.();
          if (index === steps.length - 1) {
            addLog(`Sequence ${name} complete.`);
            setActiveSequence(null);
            ignitionPhase.current = 'idle';
          }
        }, cumulativeDelay);
        sequenceTimeoutRef.current.push(timeout);
      });
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
          ignitionPhase.current = 'idle';
          clearAndRunSequence('Ignition Sequence', [
            { message: 'Sending command: IGNITION_SEQUENCE_START', delay: 500, action: () => sendCommand('SEQ_IGNITION_START') },
          ]);
          break;
        case 'Emergency Shutdown':
          ignitionPhase.current = 'idle';
          clearAndRunSequence('Emergency Shutdown', [
            { message: 'Sending command: EMERGENCY_SHUTDOWN', delay: 100, action: () => sendCommand('SEQ_SHUTDOWN') },
          ]);
          break;
        default:
          clearAndRunSequence(sequenceName, [
            {
              message: `Running diagnostics for ${sequenceName}...`,
              delay: 1000,
              action: () => sendCommand(`DIAG_${sequenceName.toUpperCase().replace(' ', '_')}`),
            },
            { message: 'Diagnostics complete.', delay: 2000 },
          ]);
          break;
      }
    },
    [activeSequence, clearAndRunSequence, sendCommand, toast]
  );

  useEffect(() => {
    return () => {
      sequenceTimeoutRef.current.forEach(clearTimeout);
    };
  }, []);

  return { sequenceLogs, activeSequence, handleSequence, addLog };
}

