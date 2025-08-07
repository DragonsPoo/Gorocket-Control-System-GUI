import { SerialPort } from 'serialport';
import type { SerialCommand, CommandType } from '@/types';

type DataCallback = (data: string) => void;

type ErrorCallback = (err: Error) => void;

export default class SerialManager {
  private port: SerialPort | null = null;

  constructor(
    private baudRate: number,
    private onData: DataCallback,
    private onError: ErrorCallback
  ) {}

  async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  }

  async connect(pathName: string): Promise<boolean> {
    if (this.port && this.port.isOpen) {
      await this.disconnect();
    }
    return new Promise((resolve) => {
      this.port = new SerialPort({ path: pathName, baudRate: this.baudRate }, (err) => {
        if (err) {
          this.onError(err);
          resolve(false);
        }
      });
      this.port.on('open', () => {
        this.port?.on('data', (d) => this.onData(d.toString()));
        this.port?.on('error', (e) => this.onError(e));
        resolve(true);
      });
    });
  }

  async disconnect(): Promise<boolean> {
    if (!this.port || !this.port.isOpen) return false;
    return new Promise((resolve) => {
      this.port?.close((err) => {
        if (err) {
          this.onError(err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async send(command: SerialCommand): Promise<boolean> {
    if (!this.port || !this.port.isOpen) return false;
    let line = '';
    switch (command.type) {
      case CommandType.VALVE:
        line = `V,${command.servoIndex},${command.action}`;
        break;
      default:
        return false;
    }
    return new Promise((resolve, reject) => {
      this.port!.write(line + '\n', (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    }).catch((err) => {
      this.onError(err);
      return false;
    });
  }
}
