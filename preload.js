const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portName) => ipcRenderer.invoke('connect-serial', portName),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
  sendToSerial: (data) => ipcRenderer.send('send-to-serial', data),
  onSerialData: (callback) => ipcRenderer.on('serial-data', (_event, value) => callback(value)),
  onSerialError: (callback) => ipcRenderer.on('serial-error', (_event, value) => callback(value)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  startLogging: () => ipcRenderer.send('start-logging'),
  stopLogging: () => ipcRenderer.send('stop-logging'),
  getConfig: () => ipcRenderer.invoke('get-config'),
});