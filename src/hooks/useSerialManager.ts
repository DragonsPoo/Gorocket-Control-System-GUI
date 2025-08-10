import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SensorData, Valve, AppConfig } from '@shared/types';
import type { SerialCommand } from '@shared/types/ipc';
import { useValveControl } from './useValveControl';
import { useSensorData } from './useSensorData';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface SerialState {
  connectionStatus: ConnectionStatus;
  serialPorts: string[];
  selectedPort: string;
  appConfig: AppConfig | null;
}

const initialState: SerialState = {
  connectionStatus: 'disconnected',
  serialPorts: [],
  selectedPort: '',
  appConfig: null,
};

type Action =
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'SET_SERIAL_PORTS'; ports: string[] }
  | { type: 'SET_SELECTED_PORT'; port: string }
  | { type: 'SET_CONFIG'; config: AppConfig };

function reducer(state: SerialState, action: Action): SerialState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };
    case 'SET_SERIAL_PORTS':
      return { ...state, serialPorts: action.ports };
    case 'SET_SELECTED_PORT':
      return { ...state, selectedPort: action.port };
    case 'SET_CONFIG':
      return { ...state, appConfig: action.config };
    default:
      return state;
  }
}

export interface SerialManagerApi {
  appConfig: AppConfig | null;
  sensorData: SensorData | null;
  chartData: SensorData[];
  valves: Valve[];
  connectionStatus: ConnectionStatus;
  serialPorts: string[];
  selectedPort: string;
  setSelectedPort: (port: string) => void;
  refreshPorts: () => Promise<void>;
  handleConnect: () => Promise<void>;
  sendCommand: (cmd: SerialCommand) => Promise<boolean>;
  handleValveChange: (valveId: number, targetState: 'OPEN' | 'CLOSED') => Promise<void>;
  setLogger: (logger: (msg: string) => void) => void;
  setSequenceHandler: (handler: (name: string) => void) => void;
  resetEmergency: () => void;
}

export function useSerialManager(): SerialManagerApi {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);
  const loggerRef = useRef<(msg: string) => void>(() => {});
  const sequenceHandlerRef = useRef<(name: string) => void>(() => {});
  const emergencyTriggered = useRef(false);

  const handleEmergency = useCallback(() => {
    if (emergencyTriggered.current) return;
    emergencyTriggered.current = true;
    sequenceHandlerRef.current('Emergency Shutdown');
  }, []);

  const sendCommand = useCallback(
    async (cmd: SerialCommand) => {
      if (state.connectionStatus !== 'connected') {
        toast({ title: 'Not Connected', description: 'Must be connected to send commands.', variant: 'destructive' });
        return false;
      }
      const success = await window.electronAPI.sendToSerial(cmd);
      if (!success) {
        toast({ title: 'Command Error', description: 'Failed to send command.', variant: 'destructive' });
        loggerRef.current(`Failed to send: ${JSON.stringify(cmd)}`);
      } else {
        loggerRef.current(`Sent: ${JSON.stringify(cmd)}`);
      }
      return success;
    },
    [state.connectionStatus, toast]
  );

  const { valves, handleValveChange, setValves } = useValveControl(
    sendCommand,
    state.appConfig ?? undefined
  );

  const updateValves = useCallback(
    (updates: Partial<Record<number, Partial<Valve>>>) => {
      setValves((prev: Valve[]) =>
        prev.map((v: Valve) => {
          const upd = updates[v.id];
          if (!upd) return v;
          const merged: Valve = { ...v, ...upd };
          if (upd.lsOpen) merged.state = 'OPEN';
          if (upd.lsClosed) merged.state = 'CLOSED';
          return merged;
        })
      );
    },
    [setValves]
  );

  const { sensorData, chartData, handleSerialMessage, reset } = useSensorData(
    state.appConfig?.maxChartDataPoints ?? 100,
    state.appConfig?.pressureLimit ?? null,
    handleEmergency,
    updateValves
  );

  useEffect(() => {
    const init = async () => {
      try {
        const ports = await window.electronAPI.getSerialPorts();
        dispatch({ type: 'SET_SERIAL_PORTS', ports });
        if (ports[0]) dispatch({ type: 'SET_SELECTED_PORT', port: ports[0] });

        const cfg = await window.electronAPI.getConfig();
        dispatch({ type: 'SET_CONFIG', config: cfg });
        setValves(cfg.initialValves);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        toast({
          title: 'Initialization Error',
          description: `Failed to load configuration (${message}). Emergency shutdown disabled.`,
          variant: 'destructive',
        });
      }
    };
    init();
    const cleanupData = window.electronAPI.onSerialData((d) => {
      loggerRef.current(`Received: ${d}`);
      handleSerialMessage(d);
    });
    const cleanupError = window.electronAPI.onSerialError((err) => {
      toast({ title: 'Serial Error', description: err, variant: 'destructive' });
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
    });
    return () => {
      cleanupData();
      cleanupError();
    };
  }, [handleSerialMessage, setValves, toast]);

  const handleConnect = useCallback(async () => {
    if (state.connectionStatus === 'connected') {
      await window.electronAPI.disconnectSerial();
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      loggerRef.current(`Disconnected from ${state.selectedPort}.`);
      reset();
      return;
    }
    if (!state.selectedPort) {
      toast({ title: 'Connection Error', description: 'Please select a serial port.', variant: 'destructive' });
      return;
    }
    dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });
    loggerRef.current(`Connecting to ${state.selectedPort}...`);
    const success = await window.electronAPI.connectSerial(state.selectedPort);
    if (success) {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
      emergencyTriggered.current = false;
      loggerRef.current(`Successfully connected to ${state.selectedPort}.`);
    } else {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      loggerRef.current(`Failed to connect to ${state.selectedPort}.`);
    }
  }, [state.connectionStatus, state.selectedPort, toast, reset]);

  const setSelectedPort = useCallback((port: string) => {
    dispatch({ type: 'SET_SELECTED_PORT', port });
  }, []);

  const setLogger = useCallback((logger: (msg: string) => void) => {
    loggerRef.current = logger;
  }, []);

  const setSequenceHandler = useCallback((handler: (name: string) => void) => {
    sequenceHandlerRef.current = handler;
  }, []);

  const refreshPorts = useCallback(async () => {
    const ports = await window.electronAPI.getSerialPorts();
    dispatch({ type: 'SET_SERIAL_PORTS', ports });
    dispatch({
      type: 'SET_SELECTED_PORT',
      port: ports.includes(state.selectedPort) ? state.selectedPort : '',
    });
  }, [state.selectedPort]);

  const resetEmergency = useCallback(() => {
    emergencyTriggered.current = false;
  }, []);

  return {
    appConfig: state.appConfig,
    sensorData,
    chartData,
    valves,
    connectionStatus: state.connectionStatus,
    serialPorts: state.serialPorts,
    selectedPort: state.selectedPort,
    setSelectedPort,
    refreshPorts,
    handleConnect,
    sendCommand,
    handleValveChange,
    setLogger,
    setSequenceHandler,
    resetEmergency,
  };
}

export type { SensorData, Valve };
