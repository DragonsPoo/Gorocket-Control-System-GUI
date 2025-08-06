const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portName) => ipcRenderer.invoke('connect-serial', portName),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
  sendToSerial: (data) => ipcRenderer.send('send-to-serial', data),
  onSerialData: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('serial-data', listener);
    return () => ipcRenderer.removeListener('serial-data', listener);
  },
  onSerialError: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('serial-error', listener);
    return () => ipcRenderer.removeListener('serial-error', listener);
  },
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  startLogging: () => ipcRenderer.send('start-logging'),
  stopLogging: () => ipcRenderer.send('stop-logging'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  onLogCreationFailed: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('log-creation-failed', listener);
    return () => ipcRenderer.removeListener('log-creation-failed', listener);
  },
});
