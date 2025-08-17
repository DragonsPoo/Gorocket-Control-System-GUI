export enum ValveCommandType {
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
}

export interface ValveSerialCommand {
  type: 'V';
  servoIndex: number;
  action: ValveCommandType;
}

export interface RawSerialCommand {
  type: 'RAW';
  payload: string;
}

import type { SequenceConfig } from './index';
import type { ValidationResult } from '../../main/SequenceDataManager';

export type SerialCommand = ValveSerialCommand | RawSerialCommand;

export type SequencesPayload = {
  sequences: SequenceConfig;
  result: ValidationResult;
};

export type SerialStatus = {
  state: 'connected' | 'disconnected' | 'reconnecting';
  path?: string;
};

// This is a placeholder for now, we need to define SequenceStep properly
// in a shared location if we want to use it here. For now, `any` will do.
type SequenceStep = any;

export type SequenceEvent =
  | { type: 'progress'; name: string; stepIndex: number; step: SequenceStep; note?: string }
  | { type: 'error'; name: string; stepIndex: number; step?: any; error: string }
  | { type: 'complete'; name: string };
