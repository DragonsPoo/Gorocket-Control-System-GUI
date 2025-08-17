import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SequenceEvent } from '@shared/types/ipc';

// P0-2: 메인 프로세스에 완전히 위임하는 새로운 훅
export function useSequenceRemote() {
  const { toast } = useToast();
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(['Sequence remote initialized.']);
  const [isBusy, setIsBusy] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-500));
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onSequenceEvent((event: SequenceEvent) => {
      switch (event.type) {
        case 'progress':
          if (event.note === 'start') {
            setActiveSequence(event.name);
            setIsBusy(true);
            setLogs([]); // 새 시퀀스 시작 시 로그 초기화
            addLog(`Sequence '${event.name}' step ${event.stepIndex + 1}: START`);
          }
          addLog(`[${event.name}] #${event.stepIndex + 1} ${event.step.type.toUpperCase()} ${JSON.stringify(event.step.payload)} - ${event.note}`);
          break;
        case 'error':
          addLog(`ERROR in '${event.name}' at step ${event.stepIndex + 1}: ${event.error}`);
          toast({
            title: `Sequence Error: ${event.name}`,
            description: event.error,
            variant: 'destructive',
          });
          setActiveSequence(null);
          setIsBusy(false);
          break;
        case 'complete':
          addLog(`Sequence '${event.name}' completed successfully.`);
          toast({
            title: `Sequence Complete: ${event.name}`,
            description: 'All steps executed without errors.',
          });
          setActiveSequence(null);
          setIsBusy(false);
          break;
      }
    });

    return cleanup;
  }, [addLog, toast]);

  const start = useCallback(async (name: string) => {
    if (isBusy) {
      toast({ title: 'Cannot start sequence', description: 'Another sequence is already running.', variant: 'destructive' });
      return;
    }
    try {
      setIsBusy(true);
      await window.electronAPI.startSequence(name);
    } catch (e: any) {
      toast({ title: 'Failed to start sequence', description: e.message, variant: 'destructive' });
      setIsBusy(false);
    }
  }, [isBusy, toast]);

  const cancel = useCallback(async () => {
    try {
      await window.electronAPI.cancelSequence();
      addLog('Cancellation request sent.');
      // UI 상태는 'error' 또는 'complete' 이벤트를 통해 최종적으로 업데이트됨
    } catch (e: any) {
      toast({ title: 'Failed to send cancellation', description: e.message, variant: 'destructive' });
    }
  }, [addLog, toast]);

  return {
    start,
    cancel,
    logs,
    activeSequence,
    isBusy,
  };
}
