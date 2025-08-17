import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppConfig, SerialStatus } from '@shared/types';
import { PressureSnapshot } from 'shared/types/global';

// Applying user feedback to restore multi-channel events
const api = {
  // Serial Port Management
  listSerialPorts: (): Promise<string[]> => ipcRenderer.invoke('serial-list'),
  connectSerial: (path: string, baud: number): Promise<boolean> => ipcRenderer.invoke('serial-connect', { path, baud }),
  disconnectSerial: (): Promise<boolean> => ipcRenderer.invoke('serial-disconnect'),
  onSerialStatus: (cb: (s: SerialStatus) => void) => {
    const listener = (_e: IpcRendererEvent, s: SerialStatus) => cb(s);
    ipcRenderer.on('serial-status', listener);
    return () => ipcRenderer.removeListener('serial-status', listener);
  },
  onSerialData: (callback: (data: string) => void) => {
    const listener = (_e: IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('serial-data', listener);
    return () => ipcRenderer.removeListener('serial-data', listener);
  },

  // Sequence Control (User Snippet)
  sequenceStart: (name: string) => ipcRenderer.invoke('sequence-start', name),
  sequenceCancel: () => ipcRenderer.invoke('sequence-cancel'),
  onSequenceProgress: (cb: (e: unknown) => void) => {
    const h = (_: any, p: unknown) => cb(p);
    ipcRenderer.on('sequence-progress', h);
    return () => ipcRenderer.removeListener('sequence-progress', h);
  },
  onSequenceError: (cb: (e: unknown) => void) => {
    const h = (_: any, p: unknown) => cb(p);
    ipcRenderer.on('sequence-error', h);
    return () => ipcRenderer.removeListener('sequence-error', h);
  },
  onSequenceComplete: (cb: (e: unknown) => void) => {
    const h = (_: any, p: unknown) => cb(p);
    ipcRenderer.on('sequence-complete', h);
    return () => ipcRenderer.removeListener('sequence-complete', h);
  },

  // Safety Controls
  safetyPressureExceeded: (snapshot: PressureSnapshot) => {
    ipcRenderer.send('safety:pressureExceeded', snapshot);
  },
  safetyClear: () => ipcRenderer.invoke('safety-clear'),

  // Config and Utilities
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config-get'),
  getSequences: () => ipcRenderer.invoke('get-sequences'),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
