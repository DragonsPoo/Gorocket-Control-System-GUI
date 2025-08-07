export interface ValveMappingEntry {
  servoIndex: number;
}

export interface AppConfig {
  serial: {
    baudRate: number;
  };
  valveMappings: Record<string, ValveMappingEntry>;
  constants: {
    MAX_CHART_DATA_POINTS: number;
    PRESSURE_LIMIT: number;
  };
  initialValves: { id: number; name: string }[];
}

// Sensor and valve related types
export interface SensorData {
  pt1: number;
  pt2: number;
  pt3: number;
  pt4: number;
  flow1: number;
  flow2: number;
  tc1: number;
  timestamp: number;
}

export type ValveState =
  | 'OPEN'
  | 'CLOSED'
  | 'OPENING'
  | 'CLOSING'
  | 'ERROR';

export interface Valve {
  id: number;
  name: string;
  state: ValveState;
  lsOpen: boolean;
  lsClosed: boolean;
}

export enum CommandType {
  VALVE = 'VALVE',
}

export enum ValveAction {
  OPEN = 'O',
  CLOSE = 'C',
}

export interface ValveCommand {
  type: CommandType.VALVE;
  servoIndex: number;
  action: ValveAction;
}

export type SerialCommand = ValveCommand;
