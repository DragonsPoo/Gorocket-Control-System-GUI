// P0-2: User Feedback - Standardize API surface and provide global types
import type { AppConfig, SerialStatus } from './index';
import type { SequenceEvent, SequencesPayload } from './ipc';

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

declare global {
  interface Window {
    electronAPI: {
      // Serial Port Management
      listSerialPorts: () => Promise<string[]>;
      connectSerial: (path: string, baud: number) => Promise<boolean>;
      disconnectSerial: () => Promise<boolean>;
      onSerialStatus: (cb: (s: SerialStatus) => void) => () => void;
      onSerialData: (cb: (data: string) => void) => () => void;

      // Sequence Control
      startSequence: (name: string) => Promise<boolean>;
      cancelSequence: () => Promise<boolean>;
      onSequenceEvent: (cb: (e: SequenceEvent) => void) => () => void;
      getSequences: () => Promise<SequencesPayload>;

      // Safety Controls
      safety: {
        notifyPressureExceeded: (s: PressureSnapshot) => void;
        triggerFailsafe: (reason?: string) => Promise<boolean>;
        clearEmergency: () => Promise<boolean>;
      };

      // Config and Utilities
      getConfig: () => Promise<AppConfig>;
    };
  }
}

// This is required to make the file a module.
export {};
