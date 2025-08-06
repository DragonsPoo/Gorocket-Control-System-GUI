import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import type { SerialCommand } from '../src/types/ipc';
import { ValveCommandType } from '../src/types/ipc';

export interface SerialManagerEvents {
  data: (data: string) => void;
  error: (error: Error) => void;
}

export declare interface SerialManager {
  on<U extends keyof SerialManagerEvents>(
    event: U,
    listener: SerialManagerEvents[U]
  ): this;
}

export class SerialManager extends EventEmitter {
  private port: SerialPort | null = null;

  async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  }

  async connect(path: string, baudRate: number): Promise<boolean> {
    if (this.port?.isOpen) {
      await this.disconnect();
    }
    return new Promise((resolve) => {
      this.port = new SerialPort({ path, baudRate }, (err) => {
        if (err) {
          this.emit('error', err);
          resolve(false);
        }
      });
      this.port.on('open', () => resolve(true));
      this.port.on('data', (d) => this.emit('data', d.toString()));
      this.port.on('error', (e) => this.emit('error', e));
    });
  }

  async disconnect(): Promise<boolean> {
    if (!this.port) return false;
    return new Promise((resolve) => {
      this.port!.close((err) => {
        if (err) {
          this.emit('error', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
      this.port = null;
    });
  }

  async send(command: SerialCommand): Promise<boolean> {
    if (!this.port || !this.port.isOpen) return false;
    const cmdStr = this.buildCommand(command);
    return new Promise<boolean>((resolve, reject) => {
      this.port!.write(cmdStr + '\n', (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    }).catch((err) => {
      this.emit('error', err);
      return false as boolean;
    });
  }

  private buildCommand(cmd: SerialCommand): string {
    switch (cmd.type) {
      case 'V':
        return `V,${cmd.servoIndex},${
          cmd.action === ValveCommandType.OPEN ? 'O' : 'C'
        }`;
      case 'RAW':
        return cmd.payload;
      default:
        throw new Error('Unknown command');
    }
  }
}
