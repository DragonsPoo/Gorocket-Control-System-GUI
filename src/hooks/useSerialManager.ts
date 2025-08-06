import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SensorData, Valve, ValveState, AppConfig } from '@/types';

const initialValves: Valve[] = [
  { id: 1, name: 'Ethanol Main', state: 'CLOSED', lsOpen: false, lsClosed: false },
  { id: 2, name: 'N2O Main', state: 'CLOSED', lsOpen: false, lsClosed: false },
  { id: 3, name: 'Ethanol Purge', state: 'CLOSED', lsOpen: false, lsClosed: false },
  { id: 4, name: 'N2O Purge', state: 'CLOSED', lsOpen: false, lsClosed: false },
  { id: 5, name: 'Pressurant Fill', state: 'CLOSED', lsOpen: false, lsClosed: false },
  { id: 6, name: 'System Vent', state: 'CLOSED', lsOpen: false, lsClosed: false },
  { id: 7, name: 'Igniter Fuel', state: 'CLOSED', lsOpen: false, lsClosed: false },
];

const initialSensorData: SensorData = {
  pt1: 0,
  pt2: 0,
  pt3: 0,
  pt4: 0,
  flow1: 0,
  flow2: 0,
  tc1: 0,
  timestamp: 0,
};

function isSensorDataKey(key: string): key is keyof SensorData {
  return key in initialSensorData;
}

const MAX_CHART_DATA_POINTS = 100;
const PRESSURE_LIMIT = 850; // PSI

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface SerialManagerApi {
  sensorData: SensorData | null;
  chartData: SensorData[];
  valves: Valve[];
  connectionStatus: ConnectionStatus;
  serialPorts: string[];
  selectedPort: string;
  setSelectedPort: (port: string) => void;
  handleConnect: () => Promise<void>;
  sendCommand: (cmd: string) => Promise<void>;
  handleValveChange: (valveId: number, targetState: 'OPEN' | 'CLOSED') => void;
  setLogger: (logger: (msg: string) => void) => void;
  setSequenceHandler: (handler: (name: string) => void) => void;
}

export function useSerialManager(): SerialManagerApi {
  const { toast } = useToast();
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const sensorDataRef = useRef<SensorData | null>(sensorData);
  const [chartData, setChartData] = useState<SensorData[]>([]);
  const [valves, setValves] = useState<Valve[]>(initialValves);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [serialPorts, setSerialPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const loggerRef = useRef<(msg: string) => void>(() => {});
  const sequenceHandlerRef = useRef<(name: string) => void>(() => {});
  const emergencyShutdownTriggered = useRef(false);

  useEffect(() => {
    const getPorts = async () => {
      try {
        const ports = await window.electronAPI.getSerialPorts();
        setSerialPorts(ports);
        if (ports.length > 0) {
          setSelectedPort(ports[0]);
        }
      } catch (error) {
        console.error(error);
        toast({ title: 'Connection Error', description: 'Failed to list serial ports.', variant: 'destructive' });
      }
    };
    getPorts();

    const loadConfig = async () => {
      try {
        const cfg = await window.electronAPI.getConfig();
        setAppConfig(cfg);
      } catch (error) {
        console.error(error);
        toast({ title: 'Configuration Error', description: 'Failed to load configuration.', variant: 'destructive' });
      }
    };
    loadConfig();

    const handleSerialData = (data: string) => {
      loggerRef.current(`Received: ${data}`);
      const parts = data.split(',');
      const newData: Partial<SensorData> = {};
      const newValveStates: Partial<Record<number, Partial<Valve>>> = {};

      parts.forEach((part) => {
        const [key, rawValue] = part.split(':');
        if (!key || !rawValue) return;
        const value = rawValue.trim();

        if (isSensorDataKey(key)) {
          newData[key] = parseFloat(value);
        }

        const match = key.match(/V(\d)(LS_OPEN|LS_CLOSED)/);
        if (match) {
          const valveId = parseInt(match[1]);
          const lsType = match[2];
          const lsValue = value === '1';
          if (!newValveStates[valveId]) newValveStates[valveId] = {};
          if (lsType === 'LS_OPEN') newValveStates[valveId]!.lsOpen = lsValue;
          if (lsType === 'LS_CLOSED') newValveStates[valveId]!.lsClosed = lsValue;
        }
      });

      if (Object.keys(newData).length > 0) {
        const updatedSensorData = {
          ...sensorDataRef.current,
          ...newData,
          timestamp: Date.now(),
        } as SensorData;
        setSensorData(updatedSensorData);

        if (typeof updatedSensorData.tc1 === 'number') {
          setChartData((prev) => [
            ...prev.slice(-MAX_CHART_DATA_POINTS + 1),
            updatedSensorData,
          ]);
        }

        if (
          (updatedSensorData.pt1 > PRESSURE_LIMIT ||
            updatedSensorData.pt2 > PRESSURE_LIMIT) &&
          !emergencyShutdownTriggered.current
        ) {
          loggerRef.current(
            `!!! CRITICAL PRESSURE DETECTED (PT1: ${updatedSensorData.pt1.toFixed(0)} PSI, PT2: ${updatedSensorData.pt2.toFixed(0)} PSI) !!!`
          );
          sequenceHandlerRef.current('Emergency Shutdown');
          emergencyShutdownTriggered.current = true;
        } else if (
          updatedSensorData.pt1 < PRESSURE_LIMIT &&
          updatedSensorData.pt2 < PRESSURE_LIMIT
        ) {
          emergencyShutdownTriggered.current = false;
        }
      }

      if (Object.keys(newValveStates).length > 0) {
        setValves((prevValves) =>
          prevValves.map((v) => {
            const updates = newValveStates[v.id];
            if (!updates) return v;

            const newState = { ...v, ...updates };
            if (newState.lsOpen) {
              newState.state = 'OPEN';
            } else if (newState.lsClosed) {
              newState.state = 'CLOSED';
            }
            return newState;
          })
        );
      }
    };

    const handleSerialError = (error: string) => {
      loggerRef.current(`SERIAL ERROR: ${error}`);
      toast({ title: 'Serial Port Error', description: error, variant: 'destructive' });
      setConnectionStatus('disconnected');
    };

    const cleanupSerialData = window.electronAPI.onSerialData(handleSerialData);
    const cleanupSerialError = window.electronAPI.onSerialError(handleSerialError);

    return () => {
      cleanupSerialData();
      cleanupSerialError();
    };
  }, [toast]);

  useEffect(() => {
    sensorDataRef.current = sensorData;
  }, [sensorData]);

  const handleConnect = useCallback(async () => {
    if (connectionStatus === 'connected') {
      await window.electronAPI.disconnectSerial();
      setConnectionStatus('disconnected');
      loggerRef.current(`Disconnected from ${selectedPort}.`);
    } else {
      if (!selectedPort) {
        toast({
          title: 'Connection Error',
          description: 'Please select a serial port.',
          variant: 'destructive',
        });
        return;
      }
      setConnectionStatus('connecting');
      loggerRef.current(`Connecting to ${selectedPort}...`);
      const success = await window.electronAPI.connectSerial(selectedPort);
      if (success) {
        setConnectionStatus('connected');
        loggerRef.current(`Successfully connected to ${selectedPort}.`);
      } else {
        setConnectionStatus('disconnected');
        loggerRef.current(`Failed to connect to ${selectedPort}.`);
      }
    }
  }, [connectionStatus, selectedPort, toast]);

  const sendCommand = useCallback(
    async (cmd: string) => {
      if (connectionStatus !== 'connected') {
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
        loggerRef.current(`Failed to send: ${cmd}`);
        return;
      }
      loggerRef.current(`Sent: ${cmd}`);
    },
    [connectionStatus, toast]
  );

  const handleValveChange = useCallback(
    (valveId: number, targetState: 'OPEN' | 'CLOSED') => {
      const valve = valves.find((v) => v.id === valveId);
      if (!valve) return;

      const mapping = appConfig?.valveMappings?.[valve.name];
      if (!mapping) {
        toast({
          title: 'Command Error',
          description: `No servo mapping for valve ${valve.name}.`,
          variant: 'destructive',
        });
        return;
      }

      const command = `V,${mapping.servoIndex},${targetState === 'OPEN' ? 'O' : 'C'}`;
      void sendCommand(command);

      setValves((prevValves) =>
        prevValves.map((v) =>
          v.id === valveId ? { ...v, state: targetState } : v
        )
      );
    },
    [valves, appConfig, sendCommand, toast]
  );

  const setLogger = useCallback((logger: (msg: string) => void) => {
    loggerRef.current = logger;
  }, []);

  const setSequenceHandler = useCallback(
    (handler: (name: string) => void) => {
      sequenceHandlerRef.current = handler;
    },
    []
  );

  return {
    sensorData,
    chartData,
    valves,
    connectionStatus,
    serialPorts,
    selectedPort,
    setSelectedPort,
    handleConnect,
    sendCommand,
    handleValveChange,
    setLogger,
    setSequenceHandler,
  };
}

export type { SensorData, Valve, ValveState };

