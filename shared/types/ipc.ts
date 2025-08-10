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

export type SerialCommand = ValveSerialCommand | RawSerialCommand;
