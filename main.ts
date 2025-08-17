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
    } catch (err) {
      dialog.showErrorBox('Sequences Error',
        `Failed to load sequences.json:\n${(err as Error)?.message ?? err}`);
      app.quit();
      return;
    }

    const map = this.configManager.get().valveMappings;
    const idx = (name: string) => map[name]?.servoIndex;
    const roles = {
      mains: [idx('Ethanol Main'), idx('N2O Main'), idx('Pressurant Fill'), idx('Igniter Fuel')].filter((n): n is number => n !== undefined),
      vents: [idx('System Vent')].filter((n): n is number => n !== undefined),
      purges: [idx('Ethanol Purge'), idx('N2O Purge')].filter((n): n is number => n !== undefined),
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
          this.hbDaemon?.start();
        } else {
          this.hbDaemon?.stop();
        }
    });
    this.serialManager.on('data', (line: string) => {
      // MCU에서 온 텔레메트리/로그 라인 → 렌더러로 브로드캐스트
      this.mainWindow?.webContents.send('serial-data', line);
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
        // 로그 폴더 시작
        this.logManager.start(this.mainWindow);
        return await this.serialManager.connect(path, baud);
      } catch (err) {
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
        return await this.serialManager.send(cmd);
      } catch (err) {
        dialog.showErrorBox('Send Error', (err as Error)?.message ?? String(err));
        return false;
      }
    });

    // 시퀀스 시작/중단
    ipcMain.handle('sequence-start', async (_evt, name: string) => {
      try {
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
      const config = this.configManager.get();
      const { valveMappings } = config;
      const systemVentIndex = valveMappings['System Vent']?.servoIndex;
      const ethanolPurgeIndex = valveMappings['Ethanol Purge']?.servoIndex;
      const n2oPurgeIndex = valveMappings['N2O Purge']?.servoIndex;
      
      const cmds: Array<{ raw: string }> = [
        { raw: 'HB' }, // MCU가 EMERG 중이면 HB는 NACK될 수 있으나 부담 없음
      ];
      if (systemVentIndex !== undefined) cmds.push({ raw: `V,${systemVentIndex},O` });
      if (ethanolPurgeIndex !== undefined) cmds.push({ raw: `V,${ethanolPurgeIndex},O` });
      if (n2oPurgeIndex !== undefined) cmds.push({ raw: `V,${n2oPurgeIndex},O` });
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
      this.logManager.start(this.mainWindow);
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
      // ACK 여부나 성공 여부를 기다리지 않고 즉시 전송 시도
      const config = this.configManager.get();
      const { valveMappings } = config;
      const systemVentIndex = valveMappings['System Vent']?.servoIndex;
      const ethanolPurgeIndex = valveMappings['Ethanol Purge']?.servoIndex;
      const n2oPurgeIndex = valveMappings['N2O Purge']?.servoIndex;
      
      const emergencyRawCmds = [];
      if (systemVentIndex !== undefined) emergencyRawCmds.push(`V,${systemVentIndex},O`);
      if (ethanolPurgeIndex !== undefined) emergencyRawCmds.push(`V,${ethanolPurgeIndex},O`);
      if (n2oPurgeIndex !== undefined) emergencyRawCmds.push(`V,${n2oPurgeIndex},O`);
      for (const raw of emergencyRawCmds) {
        try {
          await this.serialManager.send({ raw } as any);
        } catch (e) {
          console.error(`[SAFETY] Low-level command '${raw}' failed`, e);
        }
      }

      // 3. UI에 비상 상황 전파
      this.mainWindow?.webContents.send('sequence-error', {
        name: 'safety-trigger-pressure',
        stepIndex: -1,
        error: `UI pressure safety exceeded (${snap?.reason ?? 'unknown'})`,
      });
    });
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
