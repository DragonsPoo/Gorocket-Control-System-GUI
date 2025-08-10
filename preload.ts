import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { SerialCommand } from '@shared/types/ipc';
import type { AppConfig } from '@shared/types';

const api = {
  getSerialPorts: (): Promise<string[]> => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portName: string): Promise<boolean> =>
    ipcRenderer.invoke('connect-serial', portName),
  disconnectSerial: (): Promise<boolean> =>
    ipcRenderer.invoke('disconnect-serial'),
  sendToSerial: (data: SerialCommand): Promise<boolean> =>
    ipcRenderer.invoke('send-to-serial', data),
  onSerialData: (callback: (data: string) => void) => {
    const listener = (_e: IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('serial-data', listener);
    return () => ipcRenderer.removeListener('serial-data', listener);
  },
  onSerialError: (callback: (err: string) => void) => {
    const listener = (_e: IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('serial-error', listener);
    return () => ipcRenderer.removeListener('serial-error', listener);
  },
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  startLogging: () => ipcRenderer.send('start-logging'),
  stopLogging: () => ipcRenderer.send('stop-logging'),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  onLogCreationFailed: (callback: (err: string) => void) => {
    const listener = (_e: IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('log-creation-failed', listener);
    return () => ipcRenderer.removeListener('log-creation-failed', listener);
  },

  getSequences: () => ipcRenderer.invoke('get-sequences'),
  onSequencesUpdated: (callback: (payload: import('./shared/types/ipc').SequencesPayload) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: import('./shared/types/ipc').SequencesPayload
    ) => callback(payload);
    ipcRenderer.on('sequences-updated', handler);
    return () => ipcRenderer.removeListener('sequences-updated', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
