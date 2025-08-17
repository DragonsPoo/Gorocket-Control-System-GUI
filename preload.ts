import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { SerialCommand } from '@shared/types/ipc';
import type { AppConfig } from '@shared/types';

const PORT_RE = /^[\w\-:/\\.]{1,128}$/;

const api = {
  getSerialPorts: (): Promise<string[]> => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portName: string): Promise<boolean> => {
    if (!PORT_RE.test(portName)) return Promise.reject(new Error('invalid port'));
    return ipcRenderer.invoke('connect-serial', portName);
  },
  disconnectSerial: (): Promise<boolean> =>
    ipcRenderer.invoke('disconnect-serial'),

  // ACK 완료 시 resolve(true). 재시도/타임아웃은 메인 SerialManager가 처리.
  sendToSerial: (data: SerialCommand): Promise<boolean> => {
    if (typeof data !== 'object' || data === null) return Promise.reject(new Error('invalid command'));
    if (data.type === 'RAW') {
      if (typeof (data as any).payload !== 'string') return Promise.reject(new Error('invalid command'));
    } else if (data.type === 'V') {
      if (typeof (data as any).servoIndex !== 'number') return Promise.reject(new Error('invalid command'));
      if (!['OPEN', 'CLOSE'].includes((data as any).action)) return Promise.reject(new Error('invalid command'));
    } else {
      return Promise.reject(new Error('invalid command'));
    }
    return ipcRenderer.invoke('send-to-serial', data);
  },

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

  // 선택: 상태 알림 구독(재연결/연결/끊김)
  onSerialStatus: (cb: (s: { state: 'connected' | 'disconnected' | 'reconnecting'; path?: string }) => void) => {
    const listener = (_e: IpcRendererEvent, s: any) => cb(s);
    ipcRenderer.on('serial-status', listener);
    return () => ipcRenderer.removeListener('serial-status', listener);
  },

  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  startLogging: () => ipcRenderer.send('start-logging'),
  stopLogging: () => ipcRenderer.send('stop-logging'),
  onLogCreationFailed: (callback: (error: string) => void) => {
    const listener = (_e: IpcRendererEvent, value: string) => callback(value);
    ipcRenderer.on('log-creation-failed', listener);
    return () => ipcRenderer.removeListener('log-creation-failed', listener);
  },
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),

  getSequences: () => ipcRenderer.invoke('get-sequences'),
  onSequencesUpdated: (callback: (payload: import('./shared/types/ipc').SequencesPayload) => void) => {
    const handler = (_event: IpcRendererEvent, payload: import('./shared/types/ipc').SequencesPayload) => callback(payload);
    ipcRenderer.on('sequences-updated', handler);
    return () => ipcRenderer.removeListener('sequences-updated', handler);
  },
  
  // <<< 여기에 추가된 코드
  // 렌더러(UI)에서 감지된 압력 이상 상태를 메인 프로세스로 보고합니다.
  safetyPressureExceeded: (snapshot: any) => {
    ipcRenderer.send('safety:pressureExceeded', snapshot);
  },
  // >>> 추가된 코드 끝

  safetyClear: () => ipcRenderer.invoke('safety-clear'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
export type ElectronAPI = typeof api;
