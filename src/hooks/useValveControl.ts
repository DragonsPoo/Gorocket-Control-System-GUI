import { useState, useCallback, Dispatch, SetStateAction, useRef, useEffect } from 'react';
import type { Valve, AppConfig } from '@shared/types';
import type { SerialCommand } from '@shared/types/ipc';
import { ValveCommandType } from '@shared/types/ipc';
import { useToast } from '@/hooks/use-toast';

export interface ValveControlApi {
  valves: Valve[];
  handleValveChange: (id: number, targetState: 'OPEN' | 'CLOSED') => Promise<void>;
  setValves: Dispatch<SetStateAction<Valve[]>>;
}

export function useValveControl(
  sendCommand: (cmd: SerialCommand) => Promise<boolean>,
  config?: AppConfig
): ValveControlApi {
  const [valves, setValves] = useState<Valve[]>(config?.initialValves ?? []);
  const { toast } = useToast();
  const timeoutRefs = useRef<Record<number, NodeJS.Timeout>>({});

  const handleValveChange = useCallback(
    async (valveId: number, targetState: 'OPEN' | 'CLOSED') => {
      if (!config) return;
      const valve = valves.find((v) => v.id === valveId);
      if (!valve) return;
      const mapping = config.valveMappings[valve.name];
      if (!mapping) {
        toast({
          title: 'Warning',
          description: `Valve mapping for '${valve.name}' not found in configuration.`,
        });
        return;
      }
      const command: SerialCommand = {
        type: 'V',
        servoIndex: mapping.servoIndex,
        action: targetState === 'OPEN' ? ValveCommandType.OPEN : ValveCommandType.CLOSE,
      };
      const success = await sendCommand(command);
      if (!success) return;
      setValves((prev) =>
        prev.map((v) =>
          v.id === valveId
            ? {
                ...v,
                state: targetState === 'OPEN' ? 'OPENING' : 'CLOSING',
                lsOpen: false,
                lsClosed: false,
              }
            : v
        )
      );
      timeoutRefs.current[valveId] = setTimeout(() => {
        setValves((prev) =>
          prev.map((v) =>
            v.id === valveId && (v.state === 'OPENING' || v.state === 'CLOSING')
              ? { ...v, state: 'STUCK' }
              : v
          )
        );
        toast({
          title: 'Valve Timeout',
          description: `${valve.name} did not reach ${targetState} position.`,
          variant: 'destructive',
        });
      }, 5000);
    },
    [config, sendCommand, valves, toast]
  );

  useEffect(() => {
    valves.forEach((v) => {
      if (
        (v.state === 'OPEN' || v.state === 'CLOSED') &&
        timeoutRefs.current[v.id]
      ) {
        clearTimeout(timeoutRefs.current[v.id]);
        delete timeoutRefs.current[v.id];
      }
    });
  }, [valves]);

  return { valves, handleValveChange, setValves };
}
