import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import { ConfigManager } from './main/ConfigManager';
import { SerialManager } from './main/SerialManager';
import { LogManager } from './main/LogManager';
import type { SerialCommand } from '@shared/types/ipc';

class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private configManager = new ConfigManager();
  private serialManager = new SerialManager();
  private logManager = new LogManager();
  private ipcInitialized = false;

  async init() {
    try {
      const configPath = path.join(__dirname, 'config.json');
      await this.configManager.load(configPath);
    } catch (err) {
      dialog.showErrorBox('Configuration Error', 'Failed to load configuration file.');
      app.quit();
      return;
    }
    await app.whenReady();
    this.createWindow();
    this.setupIpc();
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    const startUrl = isDev
      ? 'http://localhost:9002'
      : `file://${path.join(__dirname, '../out/index.html')}`;
    this.mainWindow.loadURL(startUrl);
    if (isDev) {
      this.mainWindow.webContents.openDevTools();
    }
    this.mainWindow.on('closed', () => (this.mainWindow = null));
  }

  private setupIpc() {
    if (this.ipcInitialized) return;
    this.ipcInitialized = true;
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

    ipcMain.handle('get-config', () => this.configManager.get());

    ipcMain.on('start-logging', () => this.logManager.start(this.mainWindow));
    ipcMain.on('stop-logging', () => this.logManager.stop());

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
  }

}

const appInstance = new MainApp();
appInstance.init();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  if (BrowserWindow.getAllWindows().length === 0) appInstance.init();
});
