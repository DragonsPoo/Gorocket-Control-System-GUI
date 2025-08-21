import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import path from 'path';
import serve from 'electron-serve';
import isDev from 'electron-is-dev';

import { ConfigManager } from './main/ConfigManager';
import { SerialManager } from './main/SerialManager';
import { LogManager } from './main/LogManager';
import { SequenceDataManager } from './main/SequenceDataManager';
import { SequenceEngine } from './main/SequenceEngine'; // SequenceEngine 임포트
import type { SerialCommand, SerialStatus } from '@shared/types/ipc';
import { HeartbeatDaemon } from './main/HeartbeatDaemon';

class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private configManager = new ConfigManager();
  private serialManager = new SerialManager();
  private logManager = new LogManager();
  private hbDaemon = new HeartbeatDaemon(this.serialManager, 250);
  private sequenceManager: SequenceDataManager | null = null;
  private sequenceEngine: SequenceEngine | null = null; // SequenceEngine 필드 추가
  private ipcInitialized = false;
  private requiresArm = true; // Re-ARM gate flag

  getMainWindow() {
    return this.mainWindow;
  }

  async init() {
    try {
      const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
      const configPath = path.join(basePath, 'config.json');
      await this.configManager.load(configPath);
    } catch (err) {
      dialog.showErrorBox('Configuration Error',
        `Failed to load config.json:\n${(err as Error)?.message ?? err}`);
      app.quit();
      return;
    }

    // SequenceDataManager 준비
    try {
      const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
      this.sequenceManager = new SequenceDataManager(basePath);
      const validationResult = this.sequenceManager.loadAndValidate();
      if (!validationResult.valid) {
        throw new Error(validationResult.errors || 'Validation failed');
      }

      // SAFETY: Run dry-run validation and fail fast if sequences are invalid
      const dryRunResult = this.sequenceManager.dryRunAll();
      if (!dryRunResult.ok) {
        const errorMessage = `Sequence dry-run validation failed:\n${dryRunResult.errors.join('\n')}`;
        dialog.showErrorBox('Sequence Validation Error', errorMessage);
        app.quit();
        return;
      }
    } catch (err) {
      dialog.showErrorBox('Sequences Error',
        `Failed to load sequences.json:\n${(err as Error)?.message ?? err}`);
      app.quit();
      return;
    }

    const map = this.configManager.get().valveMappings;
    const idx = (name: string) => map[name]?.servoIndex;
    const roles = {
      mains: [idx('Ethanol Main Supply'), idx('N2O Main Supply'), idx('Main Pressurization')].filter((n): n is number => n !== undefined),
      vents: [idx('System Vent 1'), idx('System Vent 2')].filter((n): n is number => n !== undefined),
      purges: [idx('Ethanol Purge Line'), idx('Ethanol Fill Line')].filter((n): n is number => n !== undefined),
    };

    // SequenceEngine 생성 및 설정
    this.sequenceEngine = new SequenceEngine({
      serialManager: this.serialManager,
      sequenceDataManager: this.sequenceManager,
      configManager: this.configManager,
      getWindow: () => this.mainWindow,
      options: {
        hbIntervalMs: 0,               // 내부 HB 비활성화 (아이들 HB 데몬이 담당)
        defaultAckTimeoutMs: 1000,
        defaultFeedbackTimeoutMs: 5000,
        defaultPollMs: 50,
        autoCancelOnRendererGone: true,
        failSafeOnError: true,
        valveRoles: roles,
        pressureDebounceCount: 3,      // 압력 조건 디바운싱 샘플 수
      },
    });

    // SequenceEngine 이벤트를 렌더러로 전달
    this.sequenceEngine.on('progress', (e) => this.mainWindow?.webContents.send('sequence-progress', e));
    this.sequenceEngine.on('error', (e) => this.mainWindow?.webContents.send('sequence-error', e));
    this.sequenceEngine.on('complete', (e) => this.mainWindow?.webContents.send('sequence-complete', e));

    this.createWindow();
    this.setupIpc();

    this.serialManager.on('status', (s: SerialStatus) => {
        this.mainWindow?.webContents.send('serial-status', s);
        if (s.state === 'connected') {
          // SAFETY: Start heartbeat and send immediate first heartbeat for faster MCU arming
          this.hbDaemon?.start();
          this.hbDaemon?.sendOnce();
        } else {
          this.hbDaemon?.stop();
          // Port disconnection also triggers queue failsafe
          this.serialManager.clearQueue();
          this.serialManager.abortInflight('port closed');
          this.serialManager.abortAllPendings('port closed');
          this.requiresArm = true;
          // Stop logging on disconnection/failure
          this.logManager.stop();
          console.warn('[SAFETY] Port disconnected - queue cleared, requires re-ARM, logging stopped');
        }
    });
    this.serialManager.on('data', (line: string) => {
      // MCU에서 온 텔레메트리/로그 라인 → 렌더러로 브로드캐스트
      this.mainWindow?.webContents.send('serial-data', line);
      
      // EMERG/EMERG_CLEARED 이벤트 시 HeartbeatDaemon 제어 및 큐 페일세이프
      if (line.startsWith('EMERG')) {
        this.hbDaemon?.stop();
        // 긴급 상황 시 로그 강제 플러시
        this.logManager.forceFlush();
        // EMERG queue failsafe - clear all pending commands
        this.serialManager.clearQueue();
        this.serialManager.abortInflight('emergency');
        this.serialManager.abortAllPendings('emergency');
        this.requiresArm = true;
        console.warn('[SAFETY] EMERG detected - queue cleared, requires re-ARM');
      }
      if (line.startsWith('EMERG_CLEARED')) {
        this.hbDaemon?.start();
      }
      
      // 로그 파일에도 저장
      if (this.logManager.isLogging()) {
        const formattedLine = this.logManager.formatLogLine(line);
        this.logManager.write(formattedLine);
      }
    });
    this.serialManager.on('error', (err: Error) => {
      this.mainWindow?.webContents.send('serial-error', err.message);
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });

    // 프로세스 종료 시 로그 강제 플러시
    app.on('before-quit', () => {
      this.logManager.forceFlush();
    });

    // 비정상 종료 시에도 로그 보존
    process.on('SIGINT', () => {
      this.logManager.forceFlush();
      app.quit();
    });

    process.on('SIGTERM', () => {
      this.logManager.forceFlush();
      app.quit();
    });
  }

  private createWindow() {
    let loadURL: ((window: BrowserWindow) => Promise<void>) | undefined;
    
    if (!isDev) {
      loadURL = serve({ directory: 'out' });
    }

    this.mainWindow = new BrowserWindow({
      width: 1366,
      height: 900,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'), // 필요 시 경로 조정
      },
    });

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:9002');
      // DevTools는 개발 모드에서만 자동으로 열림
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else if (loadURL) {
      loadURL(this.mainWindow);
      // 프로덕션 모드에서는 DevTools 자동으로 열지 않음
    }
    this.mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
    
    // Set Content Security Policy for better security
    this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}; ` +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data:; " +
            "connect-src 'self';"
          ]
        }
      });
    });
    this.mainWindow.on('closed', () => (this.mainWindow = null));
    
    // 렌더러 프로세스 종료 감지
    this.mainWindow?.webContents.on('render-process-gone', (_e, details) => {
      this.sequenceEngine?.onRendererGone(details);
    });
  }

  private setupIpc() {
    if (this.ipcInitialized) return;
    this.ipcInitialized = true;

    // 포트 나열
    ipcMain.handle('serial-list', async () => {
      try {
        return await this.serialManager.listPorts();
      } catch (err) {
        dialog.showErrorBox('Serial Error', (err as Error)?.message ?? String(err));
        return [];
      }
    });

    // 연결/해제
    ipcMain.handle('serial-connect', async (_evt, { path, baud }: { path: string, baud: number }) => {
      try {
        const connected = await this.serialManager.connect(path, baud);
        if (connected) {
          // 연결 성공 후에만 로깅 시작
          this.logManager.start(this.mainWindow, this.configManager.get());
        }
        return connected;
      } catch (err) {
        // 연결 실패 시 로깅 중단 (이미 시작된 경우)
        this.logManager.stop();
        dialog.showErrorBox('Serial Error', (err as Error)?.message ?? String(err));
        return false;
      }
    });
    ipcMain.handle('serial-disconnect', async () => {
      try {
        this.logManager.stop();
        return await this.serialManager.disconnect();
      } catch (err) {
        dialog.showErrorBox('Serial Error', (err as Error)?.message ?? String(err));
        return false;
      }
    });

    // 원시 송신 (수동 명령창 등에서 사용)
    ipcMain.handle('serial-send', async (_evt, cmd: SerialCommand | { raw: string } | string) => {
      try {
        // Check if control commands are blocked due to disarmed state
        if (this.requiresArm && this.isControlCommand(cmd)) {
          throw new Error('System is disarmed - re-ARM required before sending control commands');
        }
        return await this.serialManager.send(cmd);
      } catch (err) {
        const errorMsg = (err as Error)?.message ?? String(err);
        
        // Handle BUSY errors gracefully - don't show disruptive dialog
        if (errorMsg.includes('BUSY')) {
          console.warn(`[BUSY] Command rejected by MCU: ${errorMsg}`);
          // Send error details to renderer for toast notification
          this.mainWindow?.webContents.send('serial-busy', {
            command: cmd,
            error: errorMsg
          });
          return false;
        }
        
        // Show dialog only for serious errors
        dialog.showErrorBox('Send Error', errorMsg);
        return false;
      }
    });

    // 시퀀스 시작/중단
    ipcMain.handle('sequence-start', async (_evt, name: string) => {
      try {
        // Check if system is disarmed
        if (this.requiresArm) {
          throw new Error('System is disarmed - re-ARM required before starting sequences');
        }
        await this.sequenceEngine?.start(name);
        return true;
      } catch (err) {
        dialog.showErrorBox('Sequence Error', (err as Error)?.message ?? String(err));
        return false;
      }
    });
    ipcMain.handle('sequence-cancel', async () => {
      try {
        await this.sequenceEngine?.cancel();
        return true;
      } catch (err) {
        dialog.showErrorBox('Sequence Error', (err as Error)?.message ?? String(err));
        return false;
      }
    });

    // 안전(비상) 트리거: UI에서 수동으로 페일세이프를 강제할 때 사용
    ipcMain.handle('safety-trigger', async (_evt, snapshot?: { reason?: string }) => {
      // 1. 엔진 쪽 페일세이프 호출(역할에 따라 메인 닫고 벤트/퍼지 오픈)
      try { await this.sequenceEngine?.tryFailSafe('UI_SAFETY'); } catch {}

      // 2. 저수준으로도 보강 (ACK 실패 무시하고 시도)
      // SAFETY: Using actual valve names from config
      const config = this.configManager.get();
      const { valveMappings } = config;
      const fallbackNames = ['System Vent 1', 'System Vent 2', 'Ethanol Purge Line', 'Ethanol Fill Line'];
      
      const cmds: Array<{ raw: string }> = [
        { raw: 'HB' }, // MCU가 EMERG 중이면 HB는 NACK될 수 있으나 부담 없음
      ];
      
      for (const name of fallbackNames) {
        const idx = valveMappings?.[name]?.servoIndex;
        if (typeof idx === 'number') {
          cmds.push({ raw: `V,${idx},O` });
        }
      }
      
      for (const c of cmds) {
        try {
          await this.serialManager.send(c as any);
        } catch {}
      }
      
      // 3. UI에도 비상 상황이 발생했음을 명확히 알림
      this.mainWindow?.webContents.send('sequence-error', {
        name: 'safety-trigger',
        stepIndex: -1,
        error: `Pressure safety triggered by UI (${snapshot?.reason ?? 'unknown'})`,
      });
      return true;
    });

    // 설정 요청 (렌더러가 config.json 내용을 보고싶을 때)
    ipcMain.handle('config-get', async () => {
      return this.configManager.get();
    });

    // 시퀀스 데이터 요청
    ipcMain.handle('get-sequences', async () => {
      try {
        const sequences = this.sequenceManager?.getSequences() || {};
        const result = this.sequenceManager?.getValidationResult() || { valid: false, errors: 'No sequence manager' };
        return { sequences, result };
      } catch (err) {
        dialog.showErrorBox('Sequence Error', (err as Error)?.message ?? String(err));
        return { sequences: {}, result: { valid: false, errors: (err as Error)?.message ?? String(err) } };
      }
    });

    // safety-clear IPC 핸들러 추가
    ipcMain.handle('safety-clear', async () => {
      try {
        // SerialManager는 RAW 문자열도 지원
        await this.serialManager.send({ raw: 'SAFE_CLEAR' } as any);
        return true;
      } catch {
        return false;
      }
    });

    // Zoom controls
    ipcMain.on('zoom-in', () => {
      if (this.mainWindow) {
        const current = this.mainWindow.webContents.getZoomLevel();
        this.mainWindow.webContents.setZoomLevel(Math.min(current + 0.5, 3));
      }
    });
    ipcMain.on('zoom-out', () => {
      if (this.mainWindow) {
        const current = this.mainWindow.webContents.getZoomLevel();
        this.mainWindow.webContents.setZoomLevel(Math.max(current - 0.5, -3));
      }
    });
    ipcMain.on('zoom-reset', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.setZoomLevel(0);
      }
    });

    // Logging controls
    ipcMain.on('start-logging', () => {
      this.logManager.start(this.mainWindow, this.configManager.get());
    });
    ipcMain.on('stop-logging', () => {
      this.logManager.stop();
    });

    // P0-1: UI에서 보낸 압력 초과 신호 처리
    ipcMain.on('safety:pressureExceeded', async (_evt, snap) => {
      console.warn('[SAFETY] UI pressure limit exceeded, triggering failsafe.', snap);

      // 1. 엔진의 공식 페일세이프 절차 시도
      try {
        await this.sequenceEngine?.tryFailSafe('UI_PRESSURE_EXCEEDED');
      } catch (e) {
        console.error('[SAFETY] Failsafe sequence failed', e);
      }

      // 2. 저수준으로 비상 밸브(벤트/퍼지) 개방 명령을 직접 전송 (이중 안전)
      // SAFETY: Using actual valve names from config
      const config = this.configManager.get();
      const { valveMappings } = config;
      const fallbackNames = ['System Vent 1', 'System Vent 2', 'Ethanol Purge Line', 'Ethanol Fill Line'];

      for (const name of fallbackNames) {
        const idx = valveMappings?.[name]?.servoIndex;
        if (typeof idx === 'number') {
          try {
            await this.serialManager.send({ raw: `V,${idx},O` } as any);
            console.info(`[SAFETY] Fallback OPEN '${name}' (idx=${idx})`);
          } catch (e) {
            console.error(`[SAFETY] Fallback open failed '${name}' (idx=${idx})`, e);
          }
        } else {
          console.warn(`[SAFETY] Fallback mapping missing for '${name}'`);
        }
      }

      // 3. UI에 비상 상황 전파
      this.mainWindow?.webContents.send('sequence-error', {
        name: 'safety-trigger-pressure',
        stepIndex: -1,
        error: `UI pressure safety exceeded (${snap?.reason ?? 'unknown'})`,
      });
    });

    // Re-ARM system IPC handler
    ipcMain.handle('system-arm', async () => {
      try {
        this.requiresArm = false;
        console.info('[SAFETY] System re-armed - control commands enabled');
        return true;
      } catch (err) {
        return false;
      }
    });

    // Get system arm status
    ipcMain.handle('system-arm-status', async () => {
      return !this.requiresArm;
    });
  }

  // Check if command is a control command that should be blocked when disarmed
  private isControlCommand(cmd: SerialCommand | { raw: string } | string): boolean {
    if (typeof cmd === 'string') {
      const upper = cmd.toUpperCase();
      return upper.startsWith('V,') || upper.startsWith('FAILSAFE');
    }
    if ('raw' in cmd) {
      const upper = cmd.raw.toUpperCase();
      return upper.startsWith('V,') || upper.startsWith('FAILSAFE');
    }
    // SerialCommand type
    return cmd.type === 'V' || (cmd.type === 'RAW' && cmd.payload.toUpperCase().startsWith('V,'));
  }
}

// electron-serve를 위한 protocol 등록을 app.ready 이전에 수행
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        allowServiceWorkers: true,
        supportFetchAPI: true
      }
    }
  ]);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const mainApp = new MainApp();
  app.on('second-instance', () => {
    const win = mainApp.getMainWindow();
    if (win) { win.show(); win.focus(); }
  });
  app.whenReady().then(() => mainApp.init());
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) (mainApp as any)['createWindow']?.();
  });
}
