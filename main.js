const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { SerialPort } = require('serialport');

let mainWindow;
let port;
let logStream;
let appConfig;

function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => (mainWindow = null));
}

app.whenReady().then(() => {
  const configPath = path.join(__dirname, 'config.json');
  try {
    appConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
      console.error('Failed to load config:', err);
      // 더 안정적인 기본값으로 설정
      appConfig = { serial: { baudRate: 9600 }, valveMappings: {} };
      dialog.showErrorBox('Configuration Error', 'Failed to load configuration file. Using default settings.');
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- Zoom Control ---
ipcMain.on('zoom-in', () => {
  if (mainWindow) {
    const currentZoom = mainWindow.webContents.getZoomFactor();
    mainWindow.webContents.setZoomFactor(currentZoom + 0.1);
  }
});

ipcMain.on('zoom-out', () => {
  if (mainWindow) {
    const currentZoom = mainWindow.webContents.getZoomFactor();
    mainWindow.webContents.setZoomFactor(currentZoom - 0.1);
  }
});

ipcMain.on('zoom-reset', () => {
  if (mainWindow) {
    mainWindow.webContents.setZoomFactor(1.0);
  }
});

ipcMain.handle('get-config', () => appConfig);

ipcMain.on('start-logging', () => {
  const timestamp = new Date();
  const fileName = `rocket-log-${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}-${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}.csv`;
  // 올바른 경로로 수정된 최종 버전입니다.
  const filePath = path.join(app.getPath('documents'), fileName);
  logStream = fs.createWriteStream(filePath, { flags: 'w' });
  logStream.on('error', (err) => {
    console.error('Failed to create log file:', err);
    mainWindow?.webContents.send('log-creation-failed', err.message);
  });
  logStream.write('timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1\n');
});

ipcMain.on('stop-logging', () => {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
});

// --- 시리얼 통신 관련 코드 ---
ipcMain.handle('get-serial-ports', async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    const ports = await SerialPort.list();
    return ports.map(p => p.path);
  } catch (error) {
    console.error('Failed to list serial ports:', error);
    mainWindow?.webContents.send('serial-error', 'Failed to list serial ports.');
    return [];
  }
});

ipcMain.handle('connect-serial', async (event, portName) => {
  if (port && port.isOpen) {
    await new Promise(resolve => port.close(resolve));
  }

  const baudRate = appConfig?.serial?.baudRate || 9600;

  return new Promise((resolve) => {
    port = new SerialPort({ path: portName, baudRate }, (err) => {
      if (err) {
        console.error('Failed to open port:', err);
        resolve(false);
      }
    });

    port.on('open', () => {
      console.log(`Serial port ${portName} opened`);
      port.on('data', (data) => {
        const str = data.toString();
        mainWindow.webContents.send('serial-data', str);

        if (logStream) {
          const parts = str.split(',');
          const parsed = {};
          parts.forEach(part => {
            const [key, value] = part.split(':');
            if (key && value) {
              parsed[key.trim()] = value.trim();
            }
          });
          const fields = ['pt1','pt2','pt3','pt4','flow1','flow2','tc1'];
          const line = `${Date.now()},${fields.map(f => parsed[f] || '').join(',')}\n`;
          logStream.write(line);
        }
      });
      port.on('error', (err) => {
        console.error('Serial Port Error: ', err);
        mainWindow.webContents.send('serial-error', err.message);
      });
      resolve(true);
    });
  });
});

ipcMain.handle('disconnect-serial', async () => {
  if (port && port.isOpen) {
    return new Promise(resolve => {
      port.close((err) => {
        if (err) {
          console.error('Failed to close port:', err);
          resolve(false);
        } else {
          console.log('Serial port disconnected');
          resolve(true);
        }
      });
    });
  }
  return false;
});

  ipcMain.on('send-to-serial', (event, data) => {
    // Validate command format before sending to serial port
    const isValid = /^V,(\d+),(O|C)$/.test(data);
    if (!isValid) {
      console.error('Invalid command format received:', data);
      return;
    }
    if (port && port.isOpen) {
      port.write(data + '\n', (err) => {
        if (err) {
          console.error('Error writing to serial port:', err);
        }
      });
    }
  });
