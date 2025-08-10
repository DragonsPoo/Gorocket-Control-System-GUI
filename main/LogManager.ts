import fs from 'fs';
import path from 'path';
import { app, BrowserWindow } from 'electron';

export class LogManager {
  private stream: fs.WriteStream | null = null;

  start(window?: BrowserWindow | null) {
    const filePath = this.getLogPath();
    try {
      this.stream = fs.createWriteStream(filePath, { flags: 'w' });
      this.stream.on('error', () => {
        window?.webContents.send('log-creation-failed');
      });
      this.stream.write('timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1,tc2\n');
    } catch {
      window?.webContents.send('log-creation-failed');
      this.stream = null;
    }
  }

  stop() {
    this.stream?.end();
    this.stream = null;
  }

  write(line: string) {
    this.stream?.write(line);
  }

  private getLogPath(): string {
    const timestamp = new Date();
    const fileName = `rocket-log-${timestamp.getFullYear()}${String(
      timestamp.getMonth() + 1
    ).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}-${String(
      timestamp.getHours()
    ).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(
      timestamp.getSeconds()
    ).padStart(2, '0')}.csv`;
    return path.join(app.getPath('documents'), fileName);
  }

  isLogging(): boolean {
    return !!this.stream;
  }
}
