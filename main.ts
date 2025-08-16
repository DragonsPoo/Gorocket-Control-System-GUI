import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import serve from 'electron-serve';
import isDev from 'electron-is-dev';

import { ConfigManager } from './main/ConfigManager';
import { SerialManager } from './main/SerialManager';
import { LogManager } from './main/LogManager';
import { SequenceDataManager } from './main/SequenceDataManager';
import { SequenceEngine } from './main/SequenceEngine'; // SequenceEngine 임포트
import type { SerialCommand } from '@shared/types/ipc';

class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private configManager = new ConfigManager();
  private serialManager = new SerialManager();
  private logManager = new LogManager();
  private sequenceManager: SequenceDataManager | null = null;
  private sequenceEngine: SequenceEngine | null = null; // SequenceEngine 필드 추가
  private ipcInitialized = false;

  async init() {
    try {
      const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
      const configPath = path.join(basePath, 'config.json');
      await this.configManager.load(configPath);
    } catch (err) {
      dialog.showErrorBox('Configuration Error', 'Failed to load configuration file.');
      app.quit();
      return;
    }
    await app.whenReady();
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    this.sequenceManager = new SequenceDataManager(basePath);
    this.sequenceManager.loadAndValidate();

    // SequenceEngine 생성 및 설정
    this.sequenceEngine = new SequenceEngine({
      serialManager: this.serialManager,
      sequenceManager: this.sequenceManager,
      configManager: this.configManager,
      getWindow: () => this.mainWindow,
      options: {
        hbIntervalMs: 1000,
        defaultAckTimeoutMs: 1000,
        defaultFeedbackTimeoutMs: 5000,
        defaultPollMs: 50,
        autoCancelOnRendererGone: true,
        failSafeOnError: true,
        // config.json에서 역할을 읽어오도록 확장할 수 있습니다.
        valveRoles: { mains: [0, 1, 2, 3, 4], vent: 5, purge: 6 },
      },
    });

    // SequenceEngine 이벤트를 렌더러로 전달
    this.sequenceEngine.on('progress', (e) => this.mainWindow?.webContents.send('sequence-progress', e));
    this.sequenceEngine.on('error', (e) => this.mainWindow?.webContents.send('sequence-error', e));
    this.sequenceEngine.on('complete', (e) => this.mainWindow?.webContents.send('sequence-complete', e));

    this.createWindow();
    this.setupIpc();

    this.sequenceManager.watch((sequences, result) => {
      this.mainWindow?.webContents.send('sequences-updated', { sequences, result });
    });
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:9002');
      this.mainWindow.webContents.openDevTools();
    } else {
      const loadURL = serve({ directory: 'out' });
      loadURL(this.mainWindow);
    }
    this.mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
    this.mainWindow.on('closed', () => (this.mainWindow = null));
    
    // 렌더러 프로세스 종료 감지
    this.mainWindow?.webContents.on('render-process-gone', (_e, details) => {
      this.sequenceEngine?.onRendererGone(details);
    });
  }

  private setupIpc() {
    if (this.ipcInitialized) return;
    this.ipcInitialized = true;

    // 줌 기능 IPC
    ipcMain.on('zoom-in', () => {
      const current = this.mainWindow?.webContents.getZoomFactor() ?? 1;
      this.mainWindow?.webContents.setZoomFactor(current + 0.1);
    });
    ipcMain.on('zoom-out', () => {
      const current = this.mainWindow?.webContents.getZoomFactor() ?? 1;
      this.mainWindow?.webContents.setZoomFactor(current - 0.1);
    });
    ipcMain.on('zoom-reset', () => {
      this.mainWindow?.webContents.setZoomFactor(1.0);
    });

    // 설정 및 시퀀스 데이터 IPC
    ipcMain.handle('get-config', () => this.configManager.get());
    ipcMain.handle('get-sequences', () => {
      if (!this.sequenceManager) return { sequences: {}, result: { valid: false, errors: 'Sequence manager not initialized' } };
      return {
        sequences: this.sequenceManager.getSequences(),
        result: this.sequenceManager.getValidationResult(),
      };
    });

    // 로깅 IPC
    ipcMain.on('start-logging', () => this.logManager.start(this.mainWindow));
    ipcMain.on('stop-logging', () => this.logManager.stop());

    // 시리얼 데이터 및 에러 이벤트 핸들링
    this.serialManager.on('data', (data) => {
      this.mainWindow?.webContents.send('serial-data', data);
      if (this.logManager.isLogging()) {
        const line = this.logManager.formatLogLine(data);
        this.logManager.write(line);
      }
    });
    this.serialManager.on('error', (err) => {
      this.mainWindow?.webContents.send('serial-error', err.message);
    });

    // 시리얼 포트 제어 IPC
    ipcMain.handle('get-serial-ports', () => {
      return this.serialManager.listPorts();
    });
    ipcMain.handle('connect-serial', async (_e, portName: string) => {
      const baudRate = this.configManager.get().serial.baudRate;
      return this.serialManager.connect(portName, baudRate);
    });
    ipcMain.handle('disconnect-serial', async () => {
      return this.serialManager.disconnect();
    });
    ipcMain.handle('send-to-serial', async (_e, cmd: SerialCommand) => {
      return this.serialManager.send(cmd);
    });

    // SequenceEngine 제어 IPC
    ipcMain.handle('sequence-start', async (_e, name: string) => {
      if (!this.sequenceEngine) throw new Error('Sequence engine not initialized');
      return this.sequenceEngine.start(name);
    });
    ipcMain.handle('sequence-cancel', async () => {
      this.sequenceEngine?.cancel();
      return true;
    });
  }

  cleanup() {
    this.sequenceEngine?.cancel();
    void this.serialManager.disconnect();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const appInstance = new MainApp();
  appInstance.init();

  app.on('second-instance', () => {
    const win = (appInstance as any).mainWindow as BrowserWindow | null;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      appInstance.init();
    }
  });

  app.on('before-quit', () => appInstance.cleanup?.());
}
