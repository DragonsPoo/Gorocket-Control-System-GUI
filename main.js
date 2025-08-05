const { app, BrowserWindow, ipcMain } = require('electron');
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
    appConfig = {};
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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
  const filePath = path.join(__dirname, fileName);
  logStream = fs.createWriteStream(filePath, { flags: 'w' });
  logStream.write('timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1\n');
});

ipcMain.on('stop-logging', () => {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
});

// --- 시리얼 통신 관련 코드 ---

// 사용 가능한 시리얼 포트 목록을 UI에 전송
ipcMain.handle('get-serial-ports', async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 200)); // Add a small delay
    const ports = await SerialPort.list();
    console.log('Available serial ports:', ports); // 추가된 로그
    return ports.map(p => p.path);
  } catch (error) {
    console.error('Failed to list serial ports:', error);
    return [];
  }
});

// 시리얼 포트 연결
ipcMain.handle('connect-serial', async (event, portName) => {
  if (port && port.isOpen) {
    await new Promise(resolve => port.close(resolve));
  }

  const baudRate = appConfig?.serial?.baudRate || 9600;

  return new Promise((resolve) => {
    const serial = new SerialPort({ path: portName, baudRate }, (err) => {
      if (err) {
        console.error('Failed to open port:', err);
        resolve(false);
      }
    });

    port = serial;

    serial.on('open', () => {
      console.log(`Serial port ${portName} opened`);
      
      serial.on('data', (data) => {
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

      serial.on('error', (err) => {
        console.error('Serial Port Error: ', err);
        mainWindow.webContents.send('serial-error', err.message);
      });

      resolve(true);
    });
  });
});

// 시리얼 포트 연결 해제
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

// 아두이노로 데이터 전송
ipcMain.on('send-to-serial', (event, data) => {
  if (port && port.isOpen) {
    port.write(data + '\n', (err) => {
      if (err) {
        console.error('Error writing to serial port:', err);
      }
    });
  }
});
