import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { EventEmitter } from 'events';
import type { SerialCommand } from '../shared/types/ipc';
import { ValveCommandType } from '../shared/types/ipc';

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
  private parser: ReadlineParser | null = null;
  private manualClose = false;

  async listPorts(): Promise<string[]> {
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  }

  async connect(path: string, baudRate: number): Promise<boolean> {
    if (this.port?.isOpen) {
      await this.disconnect();
    }
    let success = false;
    this.manualClose = false;
    try {
      this.port = new SerialPort({ path, baudRate });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          this.port?.off('error', onError);
          this.port?.off('open', onOpen);
        };
        this.port?.once('error', onError);
        this.port?.once('open', onOpen);
        setTimeout(() => {
          onError(new Error('Connection timeout'));
        }, 5000);
      });

      // handshake
      await new Promise<void>((resolve, reject) => {
        const onData = (d: string) => {
          if (d.trim() === 'READY') {
            cleanup();
            resolve();
          }
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const cleanup = () => {
          this.parser?.off('data', onData);
          this.port?.off('error', onError);
        };
        this.parser?.on('data', onData);
        this.port?.once('error', onError);
        this.port?.write('HELLO\n');
        setTimeout(() => {
          onError(new Error('Handshake timeout'));
        }, 3000);
      });

      this.port.on('close', () => {
        if (!this.manualClose) {
          this.emit('error', new Error('Port closed unexpectedly'));
        }
      });
      this.parser.on('data', (d: string) => this.emit('data', d));
      this.port.on('error', (e) => this.emit('error', e));
      success = true;
      return true;
    } catch (err) {
      this.emit('error', err as Error);
      return false;
    } finally {
      if (!success) {
        if (this.port) {
          try {
            if (this.port.isOpen) {
              await new Promise((res) => this.port!.close(() => res(undefined)));
            }
          } catch {}
          this.port.removeAllListeners();
        }
        this.parser?.removeAllListeners();
        this.port = null;
        this.parser = null;
      }
    }
  }

  async disconnect(): Promise<boolean> {
    if (!this.port) return false;
    this.manualClose = true;
    return new Promise((resolve) => {
      const currentPort = this.port!;
      currentPort.close((err) => {
        if (err) {
          this.emit('error', err);
          resolve(false);
        } else {
          resolve(true);
        }
        currentPort.removeAllListeners();
        this.parser?.removeAllListeners();
        this.parser = null;
        this.manualClose = false;
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
