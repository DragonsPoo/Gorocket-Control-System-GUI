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
