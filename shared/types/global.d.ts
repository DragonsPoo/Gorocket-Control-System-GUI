import type { AppConfig, SerialStatus, SequencesPayload } from './index';

// A snapshot of the pressure state when a safety limit is exceeded
export interface PressureSnapshot {
  timestamp: number;
  reason: 'limit' | 'rate' | 'limit+rate';
  pressure: number;
  pressureLimit: number | null;
  rate: number | null;
  rateLimit: number | null;
  history: number[];
}

// Types for multi-channel sequence events (from user feedback)
export interface SequenceProgressEvent { name: string; stepIndex: number; note?: string; }
export interface SequenceErrorEvent { name: string; stepIndex: number; error: string; }
export interface SequenceCompleteEvent { name: string; }


declare global {
  interface Window {
    electronAPI: {
      // Serial Port Management
      listSerialPorts: () => Promise<string[]>;
      connectSerial: (path: string, baud: number) => Promise<boolean>;
      disconnectSerial: () => Promise<boolean>;
      onSerialStatus: (cb: (s: SerialStatus) => void) => () => void;
      onSerialData: (cb: (data: string) => void) => () => void;
      onSerialError: (cb: (err: string) => void) => () => void;
      sendToSerial: (data: any) => Promise<boolean>;

      // Sequence Control (multi-channel)
      sequenceStart: (name: string) => Promise<boolean>;
      sequenceCancel: () => Promise<boolean>;
      onSequenceProgress: (cb: (e: SequenceProgressEvent) => void) => () => void;
      onSequenceError: (cb: (e: SequenceErrorEvent) => void) => () => void;
      onSequenceComplete: (cb: (e: SequenceCompleteEvent) => void) => () => void;

      getSequences: () => Promise<SequencesPayload>;

      // Safety Controls
      safetyPressureExceeded: (snapshot: PressureSnapshot) => void;
      safetyTrigger: (snapshot?: { reason?: string }) => Promise<boolean>;
      safetyClear: () => Promise<void>;

      // Config and Utilities
      getConfig: () => Promise<AppConfig>;
      
      // Zoom Controls
      zoomIn: () => void;
      zoomOut: () => void;
      zoomReset: () => void;
      
      // Logging
      startLogging: () => void;
      stopLogging: () => void;
      onLogCreationFailed: (cb: (err: string) => void) => () => void;
    };
  }
}

// This is required to make the file a module.
export {};
