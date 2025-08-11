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
  valveFeedbackTimeout: number;
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
  | 'ERROR'
  | 'STUCK';

export interface Valve {
  id: number;
  name: string;
  state: ValveState;
  lsOpen: boolean;
  lsClosed: boolean;
}

export interface SequenceCondition {
  sensor: keyof SensorData;
  min: number;
  max?: number | null;
  op?: 'gte' | 'lte';
  timeoutMs?: number;
}

export interface SequenceConfigStep {
  message: string;
  delay: number;
  commands: string[];
  condition?: SequenceCondition;
}

export type SequenceConfig = Record<string, SequenceConfigStep[]>;
