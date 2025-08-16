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
}

const initialState: SerialState = {
  connectionStatus: 'disconnected',
  serialPorts: [],
  selectedPort: '',
  appConfig: null,
  connectionRetryCount: 0,
  lastConnectionError: null,
};

type Action =
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'SET_SERIAL_PORTS'; ports: string[] }
  | { type: 'SET_SELECTED_PORT'; port: string }
  | { type: 'SET_CONFIG'; config: AppConfig }
  | { type: 'SET_RETRY_COUNT'; count: number }
  | { type: 'SET_CONNECTION_ERROR'; error: string | null }
  | { type: 'RESET_CONNECTION_STATE' };

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
  connectionRetryCount: number;
  lastConnectionError: string | null;
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
      // loggerRef.current(`Received: ${d}`); // 0.1초마다 출력되는 데이터 로그 비활성화
      handleSerialMessage(d);
    });
    const cleanupError = window.electronAPI.onSerialError((err) => {
      const errorMsg = `Serial communication error: ${err}`;
      toast({ title: 'Serial Error', description: errorMsg, variant: 'destructive' });
      loggerRef.current(errorMsg);
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      dispatch({ type: 'SET_CONNECTION_ERROR', error: err });
      dispatch({ type: 'SET_RETRY_COUNT', count: state.connectionRetryCount + 1 });
      
      // 자동 재연결 시도 (최대 3회)
      if (state.connectionRetryCount < 3) {
        loggerRef.current(`Attempting auto-reconnection (${state.connectionRetryCount + 1}/3)...`);
        setTimeout(async () => {
          if (state.selectedPort) {
            const success = await window.electronAPI.connectSerial(state.selectedPort);
            if (success) {
              dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
              dispatch({ type: 'RESET_CONNECTION_STATE' });
              loggerRef.current('Auto-reconnection successful');
            } else {
              loggerRef.current('Auto-reconnection failed');
            }
          }
        }, 2000 * (state.connectionRetryCount + 1)); // 점진적 지연
      } else {
        loggerRef.current('Max reconnection attempts reached. Manual intervention required.');
      }
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
      dispatch({ type: 'RESET_CONNECTION_STATE' });
      loggerRef.current(`Disconnected from ${state.selectedPort}.`);
      reset();
      return;
    }
    
    if (!state.selectedPort) {
      toast({ title: 'Connection Error', description: 'Please select a serial port.', variant: 'destructive' });
      return;
    }
    
    // 포트 가용성 사전 확인
    const availablePorts = await window.electronAPI.getSerialPorts();
    if (!availablePorts.includes(state.selectedPort)) {
      toast({ 
        title: 'Port Unavailable', 
        description: `Selected port ${state.selectedPort} is not available. Please refresh and select another port.`,
        variant: 'destructive' 
      });
      dispatch({ type: 'SET_SERIAL_PORTS', ports: availablePorts });
      return;
    }
    
    dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });
    loggerRef.current(`Connecting to ${state.selectedPort}...`);
    
    try {
      const success = await window.electronAPI.connectSerial(state.selectedPort);
      if (success) {
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
        dispatch({ type: 'RESET_CONNECTION_STATE' });
        emergencyTriggered.current = false;
        loggerRef.current(`Successfully connected to ${state.selectedPort}.`);
        toast({ title: 'Connected', description: `Connected to ${state.selectedPort}`, variant: 'default' });
      } else {
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
        const errorMsg = `Failed to connect to ${state.selectedPort}. Check cable and permissions.`;
        dispatch({ type: 'SET_CONNECTION_ERROR', error: errorMsg });
        loggerRef.current(errorMsg);
        toast({ title: 'Connection Failed', description: errorMsg, variant: 'destructive' });
      }
    } catch (error) {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      dispatch({ type: 'SET_CONNECTION_ERROR', error: errorMsg });
      loggerRef.current(`Connection error: ${errorMsg}`);
      toast({ title: 'Connection Error', description: errorMsg, variant: 'destructive' });
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
    getLatestSensorData,
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
    connectionRetryCount: state.connectionRetryCount,
    lastConnectionError: state.lastConnectionError,
  };
}

export type { SensorData, Valve };
