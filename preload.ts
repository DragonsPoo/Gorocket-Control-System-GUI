import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppConfig, SerialStatus } from '@shared/types';
import type { SequenceEvent } from '@shared/types/ipc';

// P0-2: API 표면을 '리모컨' 역할에 맞게 재정의
const api = {
  // 시리얼 연결/상태 관련 API (기존 유지)
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

  // 시퀀스 제어 API (신규/단일화)
  startSequence: (name: string) => ipcRenderer.invoke('sequence-start', name),
  cancelSequence: () => ipcRenderer.invoke('sequence-cancel'),
  onSequenceEvent: (cb: (event: SequenceEvent) => void) => {
    // 여러 채널의 이벤트를 하나로 통합하여 렌더러에 전달
    const progressListener = (_e: IpcRendererEvent, ev: any) => cb({ type: 'progress', ...ev });
    const errorListener = (_e: IpcRendererEvent, ev: any) => cb({ type: 'error', ...ev });
    const completeListener = (_e: IpcRendererEvent, ev: any) => cb({ type: 'complete', ...ev });

    ipcRenderer.on('sequence-progress', progressListener);
    ipcRenderer.on('sequence-error', errorListener);
    ipcRenderer.on('sequence-complete', completeListener);

    return () => {
      ipcRenderer.removeListener('sequence-progress', progressListener);
      ipcRenderer.removeListener('sequence-error', errorListener);
      ipcRenderer.removeListener('sequence-complete', completeListener);
    };
  },

  // 안전 관련 API (기존 유지 및 확장)
  safety: {
    triggerFailsafe: (reason: string) => ipcRenderer.invoke('safety-trigger', { reason }),
    clearEmergency: () => ipcRenderer.invoke('safety-clear'),
    notifyPressureExceeded: (snap: { psi: number; rate?: number; reason?: string }) =>
      ipcRenderer.send('safety:pressureExceeded', snap),
  },

  // 설정 및 기타 유틸리티 API (기존 유지)
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config-get'),
  getSequences: () => ipcRenderer.invoke('get-sequences'), // 시퀀스 목록 표시에 필요하므로 유지
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
