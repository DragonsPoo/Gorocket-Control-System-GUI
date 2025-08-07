export interface ValveMappingEntry {
  servoIndex: number;
}

export interface AppConfig {
  serial: {
    baudRate: number;
  };
  valveMappings: Record<string, ValveMappingEntry>;
  maxChartDataPoints: number;
  pressureLimit: number;
  initialValves: Valve[];
}

// Sensor and valve related types
export interface SensorData {
  pt1: number;
  pt2: number;
  pt3: number;
  pt4: number;
  flow1: number;
  flow2: number;
  tc1: number | string;
  tc2: number | string;
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
