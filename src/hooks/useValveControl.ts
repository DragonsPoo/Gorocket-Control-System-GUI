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

      // Prevent multiple clicks while valve is already transitioning
      if (valve.state === 'OPENING' || valve.state === 'CLOSING') {
        toast({
          title: 'Valve Busy',
          description: `${valve.name} is currently in transition. Please wait.`,
          variant: 'default',
        });
        return;
      }

      const command: SerialCommand = {
        type: 'V',
        servoIndex: mapping.servoIndex,
        action: targetState === 'OPEN' ? ValveCommandType.OPEN : ValveCommandType.CLOSE,
      };
      
      const success = await sendCommand(command);
      if (!success) {
        toast({
          title: 'Command Failed',
          description: `Failed to send ${targetState} command to ${valve.name}. MCU may be busy.`,
          variant: 'destructive',
        });
        return;
      }

      // Set transitioning state immediately after ACK received
      setValves((prev) =>
        prev.map((v) =>
          v.id === valveId
            ? {
                ...v,
                state: targetState === 'OPEN' ? 'OPENING' : 'CLOSING',
                // Keep current limit switch states until telemetry updates them
              }
            : v
        )
      );

      // Set timeout for stuck detection
      // Use configured valve feedback timeout, align fallback with ConfigManager default (3000ms)
      const timeoutMs = config?.valveFeedbackTimeout ?? 3000;
      if (timeoutRefs.current[valveId]) {
        clearTimeout(timeoutRefs.current[valveId]);
      }
      
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
          description: `${valve.name} did not reach ${targetState} position within ${timeoutMs/1000}s.`,
          variant: 'destructive',
        });
      }, timeoutMs);
    },
    [config, sendCommand, valves, toast]
  );

  useEffect(() => {
    valves.forEach((v) => {
      // Clear timeout when valve reaches final state
      if (
        (v.state === 'OPEN' || v.state === 'CLOSED' || v.state === 'STUCK') &&
        timeoutRefs.current[v.id]
      ) {
        clearTimeout(timeoutRefs.current[v.id]);
        delete timeoutRefs.current[v.id];
      }

      // Update valve state based on limit switch telemetry
      if (v.state === 'OPENING' && v.lsOpen) {
        setValves((prev) =>
          prev.map((valve) =>
            valve.id === v.id ? { ...valve, state: 'OPEN' } : valve
          )
        );
      } else if (v.state === 'CLOSING' && v.lsClosed) {
        setValves((prev) =>
          prev.map((valve) =>
            valve.id === v.id ? { ...valve, state: 'CLOSED' } : valve
          )
        );
      }
    });
  }, [valves]);

  return { valves, handleValveChange, setValves };
}
