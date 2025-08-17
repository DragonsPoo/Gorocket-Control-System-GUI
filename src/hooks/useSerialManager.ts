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
  connectionRetryCount: number;
  lastConnectionError: string | null;
  isEmergency: boolean;
}

const initialState: SerialState = {
  connectionStatus: 'disconnected',
  serialPorts: [],
  selectedPort: '',
  appConfig: null,
  connectionRetryCount: 0,
  lastConnectionError: null,
  isEmergency: false,
};

type Action =
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'SET_SERIAL_PORTS'; ports: string[] }
  | { type: 'SET_SELECTED_PORT'; port: string }
  | { type: 'SET_CONFIG'; config: AppConfig }
  | { type: 'SET_RETRY_COUNT'; count: number }
  | { type: 'SET_CONNECTION_ERROR'; error: string | null }
  | { type: 'RESET_CONNECTION_STATE' }
  | { type: 'SET_EMERGENCY'; status: boolean };

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
    case 'SET_RETRY_COUNT':
      return { ...state, connectionRetryCount: action.count };
    case 'SET_CONNECTION_ERROR':
      return { ...state, lastConnectionError: action.error };
    case 'RESET_CONNECTION_STATE':
      return { ...state, connectionRetryCount: 0, lastConnectionError: null };
    case 'SET_EMERGENCY':
      return { ...state, isEmergency: action.status };
    default:
      return state;
  }
}

export interface SerialManagerApi {
  appConfig: AppConfig | null;
  sensorData: SensorData | null;
  chartData: SensorData[];
  getLatestSensorData: () => SensorData | null;
  valves: Valve[];
  connectionStatus: ConnectionStatus;
  isEmergency: boolean;
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
  clearMcuEmergency: () => Promise<void>;
  connectionRetryCount: number;
  lastConnectionError: string | null;
}

export function useSerialManager(): SerialManagerApi {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);
  const loggerRef = useRef<(msg: string) => void>(() => {});
  const sequenceHandlerRef = useRef<(name: string) => void>(() => {});
  const emergencyTriggered = useRef(false);

  // UI에서 수동 비상 시퀀스 버튼 등을 쓸 수 있도록 유지(자동 보호는 메인/펌웨어가 담당)
  const handleEmergency = useCallback(() => {
    if (emergencyTriggered.current) return;
    emergencyTriggered.current = true;
    sequenceHandlerRef.current?.('Emergency Shutdown');
  }, []);

  const sendCommand = useCallback(
    async (cmd: SerialCommand) => {
      if (state.connectionStatus !== 'connected') {
        const errorMsg = 'Must be connected to send commands.';
        toast({ title: 'Not Connected', description: errorMsg, variant: 'destructive' });
        loggerRef.current(`Command failed - not connected: ${JSON.stringify(cmd)}`);
        return false;
      }
      
      try {
        const success = await window.electronAPI.sendToSerial(cmd);
        if (!success) {
          const errorMsg = 'Failed to send command. Connection may be unstable.';
          toast({ title: 'Command Error', description: errorMsg, variant: 'destructive' });
          loggerRef.current(`Command send failed: ${JSON.stringify(cmd)}`);
          
          // 명령 전송 실패 시 연결 상태 재확인
          const ports = await window.electronAPI.getSerialPorts();
          if (!ports.includes(state.selectedPort)) {
            dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
            loggerRef.current('Connection lost - port no longer available');
          }
        } else {
          loggerRef.current(`Command sent successfully: ${JSON.stringify(cmd)}`);
          dispatch({ type: 'RESET_CONNECTION_STATE' }); // 성공 시 오류 상태 리셋
        }
        return success;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
        toast({ title: 'Command Error', description: `Unexpected error: ${errorMsg}`, variant: 'destructive' });
        loggerRef.current(`Command error: ${errorMsg}`);
        return false;
      }
    },
    [state.connectionStatus, state.selectedPort, toast]
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

  const {
    sensorData,
    chartData,
    handleSerialMessage,
    reset,
    getLatestSensorData,
  } = useSensorData(
    state.appConfig?.maxChartDataPoints ?? 100,
    (state.appConfig as any)?.pressureLimitAlarm ?? null, // psi
    (state.appConfig as any)?.pressureRateLimit ?? null, // psi/s (옵션)
    updateValves
  );

  useEffect(() => {
    const init = async () => {
      try {
        const ports = await window.electronAPI.listSerialPorts();
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
      const event = handleSerialMessage(d);
      if (event === 'EMERG') {
        dispatch({ type: 'SET_EMERGENCY', status: true });
        toast({ title: 'MCU EMERGENCY', description: 'MCU has entered emergency state.', variant: 'destructive' });
      } else if (event === 'CLEARED') {
        dispatch({ type: 'SET_EMERGENCY', status: false });
        toast({ title: 'MCU Emergency Cleared', description: 'MCU emergency state has been cleared.', variant: 'default' });
      }
    });
    const cleanupError = window.electronAPI.onSerialError((err) => {
      const errorMsg = `Serial communication error: ${err}`;
      toast({ title: 'Serial Error', description: errorMsg, variant: 'destructive' });
      loggerRef.current(errorMsg);
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      dispatch({ type: 'SET_CONNECTION_ERROR', error: String(err) });
      dispatch({ type: 'SET_RETRY_COUNT', count: state.connectionRetryCount + 1 });
    });

    const cleanupStatus = window.electronAPI.onSerialStatus(status => {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: status.state });
      if (status.state === 'disconnected') {
        dispatch({ type: 'SET_EMERGENCY', status: false });
      }
    });

    return () => {
      cleanupData();
      cleanupError();
      cleanupStatus();
    };
  }, [handleSerialMessage, setValves, toast, state.connectionRetryCount, state.selectedPort]);

  const handleConnect = useCallback(async () => {
    if (state.connectionStatus === 'connected') {
      await window.electronAPI.disconnectSerial();
      reset();
      return;
    }
    if (!state.selectedPort) {
      toast({ title: 'Connection Error', description: 'Please select a serial port.', variant: 'destructive' });
      return;
    }
    await window.electronAPI.connectSerial(state.selectedPort, state.appConfig?.serial.baudRate ?? 115200);
  }, [state.connectionStatus, state.selectedPort, state.appConfig, toast, reset]);

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
    const ports = await window.electronAPI.listSerialPorts();
    dispatch({ type: 'SET_SERIAL_PORTS', ports });
    if (!ports.includes(state.selectedPort)) {
      dispatch({ type: 'SET_SELECTED_PORT', port: '' });
    }
  }, [state.selectedPort]);

  const resetEmergency = useCallback(() => {
    emergencyTriggered.current = false;
  }, []);

  const clearMcuEmergency = useCallback(async () => {
    await window.electronAPI.safety.clearEmergency();
  }, []);

  return {
    appConfig: state.appConfig,
    sensorData,
    chartData,
    getLatestSensorData,
    valves,
    connectionStatus: state.connectionStatus,
    isEmergency: state.isEmergency,
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
    clearMcuEmergency,
    connectionRetryCount: state.connectionRetryCount,
    lastConnectionError: state.lastConnectionError,
  };
}

export type { SensorData, Valve };
