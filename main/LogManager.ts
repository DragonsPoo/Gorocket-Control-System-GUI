import fs from 'fs';
import path from 'path';
import { app, BrowserWindow } from 'electron';
import { parseSensorData } from '@shared/utils/sensorParser';

export class LogManager {
  private stream: fs.WriteStream | null = null;
  private sessionDir: string | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushEveryMs = 2000; // 주기 플러시(2s)

  start(window?: BrowserWindow | null) {
    try {
      // 세션 폴더 생성
      const sessionDir = this.getSessionDir();
      this.sessionDir = sessionDir;
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // 설정/시퀀스 스냅샷 복제
      this.snapshotFiles(sessionDir, window);

      // CSV 스트림 오픈
      const filePath = path.join(sessionDir, 'data.csv');
      this.stream = fs.createWriteStream(filePath, { flags: 'w' });
      this.stream.on('error', () => {
        window?.webContents.send('log-creation-failed');
      });
      this.stream.once('open', () => {
        // 헤더 작성
        this.stream?.write('timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1,tc2,valves\n');
        // 주기 플러시 시작
        this.startFlushTimer();
      });
    } catch {
      window?.webContents.send('log-creation-failed');
      this.stream = null;
      this.clearFlushTimer();
      this.sessionDir = null;
    }
  }

  stop() {
    try {
      // 최종 플러시
      if (this.stream && typeof (this.stream as any).fd === 'number') {
        try {
          fs.fsyncSync((this.stream as any).fd as number);
        } catch { /* noop */ }
      }
    } catch { /* noop */ }

    this.clearFlushTimer();
    this.stream?.end();
    this.stream = null;
    this.sessionDir = null;
  }

  write(line: string) {
    this.stream?.write(line);
  }

  isLogging(): boolean {
    return !!this.stream;
  }

  formatLogLine(raw: string): string {
    if (!raw || raw.trim() === '') return '';
    
    // Filter out ACK/NACK lines as per requirements
    if (raw.startsWith('ACK,') || raw.startsWith('NACK,')) {
      return '';
    }
    
    // Mark state events with # for post-analysis
    if (raw.startsWith('EMERG') || raw.startsWith('FAILSAFE') || raw.startsWith('READY')) {
      return `${new Date().toISOString()} # ${raw}\n`;
    }
    
    const { sensor, valves, errors } = parseSensorData(raw);
    if (errors.length) {
      errors.forEach((e) => this.write(`# ${e}\n`));
    }
    const fields = ['pt1', 'pt2', 'pt3', 'pt4', 'flow1', 'flow2', 'tc1', 'tc2'];
    const valveStates = Object.entries(valves)
      .map(([id, v]) => {
        const state = (v as any)?.lsOpen ? 'OPEN' : (v as any)?.lsClosed ? 'CLOSED' : 'UNKNOWN';
        return `V${id}:${state}`;
      })
      .join(' ');
    return `${new Date().toISOString()},${fields.map((f) => (sensor as Record<string, unknown>)[f] ?? '').join(',')},${valveStates}\n`;
  }

  // 내부 유틸 아래부터

  private getSessionDir(): string {
    const root = path.join(app.getPath('documents'), 'rocket-logs');
    const ts = new Date();
    const yyyy = ts.getFullYear();
    const mm = String(ts.getMonth() + 1).padStart(2, '0');
    const dd = String(ts.getDate()).padStart(2, '0');
    const hh = String(ts.getHours()).padStart(2, '0');
    const mi = String(ts.getMinutes()).padStart(2, '0');
    const ss = String(ts.getSeconds()).padStart(2, '0');
    const folder = `session-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
    return path.join(root, folder);
  }

  private snapshotFiles(sessionDir: string, window?: BrowserWindow | null) {
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    const files = ['config.json', 'sequences.json'];
    for (const name of files) {
      try {
        const src = path.join(basePath, name);
        const dst = path.join(sessionDir, name);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dst);
        } else {
          // 원본이 없으면 비어있는 파일로 마킹
          fs.writeFileSync(dst, `// ${name} not found at ${src}\n`);
        }
      } catch {
        window?.webContents.send('log-creation-failed');
      }
    }
  }

  private startFlushTimer() {
    this.clearFlushTimer();
    this.flushTimer = setInterval(() => {
      try {
        // 스트림이 열려 있고 fd가 있으면 fsync
        if (this.stream && typeof (this.stream as any).fd === 'number') {
          fs.fsync((this.stream as any).fd as number, () => { /* noop */ });
        }
      } catch { /* noop */ }
    }, this.flushEveryMs);
  }

  private clearFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
