import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import ConfigManager from './electron/ConfigManager';
import SerialManager from './electron/SerialManager';
import LogManager from './electron/LogManager';
import type { AppConfig, SerialCommand } from '@/types';
import { parseSensorPacket } from '@/utils/sensorParser';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.ts'),
    },
  });

  const startUrl = isDev
    ? 'http://localhost:9002'
    : `file://${path.join(__dirname, '../out/index.html')}`;
  void win.loadURL(startUrl);
  if (isDev) {
    win.webContents.openDevTools();
  }
  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

app.whenReady().then(async () => {
  const configPath = path.join(__dirname, 'config.json');
  let appConfig: AppConfig;
  try {
    appConfig = await ConfigManager.load(configPath);
  } catch (err: any) {
    console.error('Failed to load config:', err);
    dialog.showErrorBox(
      'Configuration Error',
      'Failed to load configuration file. Using default settings.'
    );
    appConfig = {
      serial: { baudRate: 9600 },
      valveMappings: {},
      constants: { MAX_CHART_DATA_POINTS: 100, PRESSURE_LIMIT: 0 },
      initialValves: [],
    };
  }

  mainWindow = createWindow();
  const logManager = new LogManager();
  const serialManager = new SerialManager(
    appConfig.serial.baudRate,
    (data) => {
      mainWindow?.webContents.send('serial-data', data);
      const parsed = parseSensorPacket(data);
      const fields = ['pt1', 'pt2', 'pt3', 'pt4', 'flow1', 'flow2', 'tc1'];
      const csv = `${Date.now()},${fields
        .map((f) => (parsed.sensors as any)[f] ?? '')
        .join(',')}\n`;
      logManager.write(csv);
    },
    (err) => mainWindow?.webContents.send('serial-error', err.message)
  );

  ipcMain.handle('get-config', () => appConfig);
  ipcMain.handle('get-serial-ports', () => serialManager.listPorts());
  ipcMain.handle('connect-serial', (_e, portName: string) =>
    serialManager.connect(portName)
  );
  ipcMain.handle('disconnect-serial', () => serialManager.disconnect());
  ipcMain.handle('send-to-serial', (_e, cmd: SerialCommand) =>
    serialManager.send(cmd)
  );

  ipcMain.on('start-logging', () => logManager.start());
  ipcMain.on('stop-logging', () => logManager.stop());

  ipcMain.on('zoom-in', () => {
    const currentZoom = mainWindow?.webContents.getZoomFactor() ?? 1;
    mainWindow?.webContents.setZoomFactor(currentZoom + 0.1);
  });
  ipcMain.on('zoom-out', () => {
    const currentZoom = mainWindow?.webContents.getZoomFactor() ?? 1;
    mainWindow?.webContents.setZoomFactor(currentZoom - 0.1);
  });
  ipcMain.on('zoom-reset', () => {
    mainWindow?.webContents.setZoomFactor(1.0);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    mainWindow = createWindow();
  }
});
