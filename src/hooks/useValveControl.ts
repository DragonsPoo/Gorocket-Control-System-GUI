import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import type { Valve, AppConfig } from '@shared/types';
import type { SerialCommand } from '@shared/types/ipc';
import { ValveCommandType } from '@shared/types/ipc';

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

  const handleValveChange = useCallback(
    async (valveId: number, targetState: 'OPEN' | 'CLOSED') => {
      if (!config) return;
      const valve = valves.find((v) => v.id === valveId);
      if (!valve) return;
      const mapping = config.valveMappings[valve.name];
      if (!mapping) return;
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
    },
    [config, sendCommand, valves]
  );

  return { valves, handleValveChange, setValves };
}
