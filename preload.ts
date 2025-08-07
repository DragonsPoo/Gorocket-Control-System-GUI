import { contextBridge, ipcRenderer } from 'electron';
import type { SerialCommand, AppConfig } from '@/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getSerialPorts: (): Promise<string[]> => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portName: string): Promise<boolean> =>
    ipcRenderer.invoke('connect-serial', portName),
  disconnectSerial: (): Promise<boolean> => ipcRenderer.invoke('disconnect-serial'),
  sendToSerial: (data: SerialCommand): Promise<boolean> =>
    ipcRenderer.invoke('send-to-serial', data),
  onSerialData: (callback: (value: string) => void) => {
    const listener = (_event: unknown, value: string) => callback(value);
    ipcRenderer.on('serial-data', listener);
    return () => ipcRenderer.removeListener('serial-data', listener);
  },
  onSerialError: (callback: (value: string) => void) => {
    const listener = (_event: unknown, value: string) => callback(value);
    ipcRenderer.on('serial-error', listener);
    return () => ipcRenderer.removeListener('serial-error', listener);
  },
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  startLogging: () => ipcRenderer.send('start-logging'),
  stopLogging: () => ipcRenderer.send('stop-logging'),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  onLogCreationFailed: (callback: (value: string) => void) => {
    const listener = (_event: unknown, value: string) => callback(value);
    ipcRenderer.on('log-creation-failed', listener);
    return () => ipcRenderer.removeListener('log-creation-failed', listener);
  },
});
