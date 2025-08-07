import { useEffect, useReducer, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSensorData } from '@/hooks/useSensorData';
import { useValveControl } from '@/hooks/useValveControl';
import type {
  SensorData,
  Valve,
  AppConfig,
  SerialCommand,
  CommandType,
  ValveAction,
} from '@/types';
import { parseSensorPacket } from '@/utils/sensorParser';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface State {
  connectionStatus: ConnectionStatus;
  serialPorts: string[];
  selectedPort: string;
  appConfig: AppConfig | null;
}

type Action =
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'SET_SERIAL_PORTS'; ports: string[] }
  | { type: 'SET_SELECTED_PORT'; port: string }
  | { type: 'SET_CONFIG'; config: AppConfig };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };
    case 'SET_SERIAL_PORTS':
      return {
        ...state,
        serialPorts: action.ports,
        selectedPort: action.ports[0] ?? '',
      };
    case 'SET_SELECTED_PORT':
      return { ...state, selectedPort: action.port };
    case 'SET_CONFIG':
      return { ...state, appConfig: action.config };
    default:
      return state;
  }
}

export interface SerialManagerApi {
  sensorData: SensorData | null;
  chartData: SensorData[];
  valves: Valve[];
  connectionStatus: ConnectionStatus;
  serialPorts: string[];
  selectedPort: string;
  setSelectedPort: (port: string) => void;
  handleConnect: () => Promise<void>;
  sendCommand: (cmd: SerialCommand) => Promise<void>;
  handleValveChange: (valveId: number, targetState: 'OPEN' | 'CLOSED') => void;
  setLogger: (logger: (msg: string) => void) => void;
  setSequenceHandler: (handler: (name: string) => void) => void;
}

export function useSerialManager(): SerialManagerApi {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(reducer, {
    connectionStatus: 'disconnected',
    serialPorts: [],
    selectedPort: '',
    appConfig: null,
  });

  const loggerRef = useRef<(msg: string) => void>(() => {});
  const sequenceHandlerRef = useRef<(name: string) => void>(() => {});

  const maxPoints = state.appConfig?.constants.MAX_CHART_DATA_POINTS ?? 100;
  const pressureLimit = state.appConfig?.constants.PRESSURE_LIMIT ?? 0;

  const { sensorData, chartData, handleRawData } = useSensorData(
    pressureLimit,
    maxPoints,
    () => sequenceHandlerRef.current('Emergency Shutdown')
  );
  const { valves, setValves, updateValve } = useValveControl([]);

  useEffect(() => {
    const init = async () => {
      try {
        const ports = await window.electronAPI.getSerialPorts();
        dispatch({ type: 'SET_SERIAL_PORTS', ports });
      } catch {
        toast({
          title: 'Connection Error',
          description: 'Failed to list serial ports.',
          variant: 'destructive',
        });
      }
      try {
        const cfg = await window.electronAPI.getConfig();
        dispatch({ type: 'SET_CONFIG', config: cfg });
        const initialValves: Valve[] = cfg.initialValves.map((v) => ({
          ...v,
          state: 'CLOSED',
          lsOpen: false,
          lsClosed: false,
        }));
        setValves(initialValves);
      } catch {
        toast({
          title: 'Configuration Error',
          description: 'Failed to load configuration.',
          variant: 'destructive',
        });
      }
    };
    init();

    const cleanupData = window.electronAPI.onSerialData((data: string) => {
      loggerRef.current(`Received: ${data}`);
      const parsed = parseSensorPacket(data);
      handleRawData(data);
      Object.entries(parsed.valves).forEach(([id, updates]) =>
        updateValve(Number(id), updates)
      );
    });
    const cleanupError = window.electronAPI.onSerialError((err: string) => {
      loggerRef.current(`SERIAL ERROR: ${err}`);
      toast({ title: 'Serial Port Error', description: err, variant: 'destructive' });
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
    });

    return () => {
      cleanupData();
      cleanupError();
    };
  }, [handleRawData, updateValve, toast]);

  const handleConnect = useCallback(async () => {
    if (state.connectionStatus === 'connected') {
      await window.electronAPI.disconnectSerial();
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      loggerRef.current(`Disconnected from ${state.selectedPort}.`);
      return;
    }

    if (!state.selectedPort) {
      toast({
        title: 'Connection Error',
        description: 'Please select a serial port.',
        variant: 'destructive',
      });
      return;
    }
    dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });
    loggerRef.current(`Connecting to ${state.selectedPort}...`);
    const success = await window.electronAPI.connectSerial(state.selectedPort);
    if (success) {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
      loggerRef.current(`Successfully connected to ${state.selectedPort}.`);
    } else {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      loggerRef.current(`Failed to connect to ${state.selectedPort}.`);
    }
  }, [state.connectionStatus, state.selectedPort, toast]);

  const sendCommand = useCallback(
    async (cmd: SerialCommand) => {
      if (state.connectionStatus !== 'connected') {
        toast({
          title: 'Not Connected',
          description: 'Must be connected to a serial port to send commands.',
          variant: 'destructive',
        });
        return;
      }
      const success = await window.electronAPI.sendToSerial(cmd);
      if (!success) {
        toast({
          title: 'Command Error',
          description: 'Failed to send command.',
          variant: 'destructive',
        });
        loggerRef.current(`Failed to send: ${JSON.stringify(cmd)}`);
        return;
      }
      loggerRef.current(`Sent: ${JSON.stringify(cmd)}`);
    },
    [state.connectionStatus, toast]
  );

  const handleValveChange = useCallback(
    (valveId: number, targetState: 'OPEN' | 'CLOSED') => {
      const valve = valves.find((v) => v.id === valveId);
      if (!valve) return;
      const mapping = state.appConfig?.valveMappings?.[valve.name];
      if (!mapping) {
        toast({
          title: 'Command Error',
          description: `No servo mapping for valve ${valve.name}.`,
          variant: 'destructive',
        });
        return;
      }
      const command: SerialCommand = {
        type: CommandType.VALVE,
        servoIndex: mapping.servoIndex,
        action: targetState === 'OPEN' ? ValveAction.OPEN : ValveAction.CLOSE,
      };
      void sendCommand(command);
      updateValve(valveId, { state: targetState });
    },
    [valves, state.appConfig, sendCommand, toast, updateValve]
  );

  const setLogger = useCallback((logger: (msg: string) => void) => {
    loggerRef.current = logger;
  }, []);

  const setSequenceHandler = useCallback((handler: (name: string) => void) => {
    sequenceHandlerRef.current = handler;
  }, []);

  return {
    sensorData,
    chartData,
    valves,
    connectionStatus: state.connectionStatus,
    serialPorts: state.serialPorts,
    selectedPort: state.selectedPort,
    setSelectedPort: (port: string) => dispatch({ type: 'SET_SELECTED_PORT', port }),
    handleConnect,
    sendCommand,
    handleValveChange,
    setLogger,
    setSequenceHandler,
  };
}

export type { SensorData, Valve };
