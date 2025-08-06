
export {};

declare global {
  interface Window {
    electronAPI: {
      getSerialPorts: () => Promise<string[]>;
      connectSerial: (portName: string) => Promise<boolean>;
      disconnectSerial: () => Promise<boolean>;
      sendToSerial: (data: string) => void;
      onSerialData: (callback: (data: string) => void) => () => void;
      onSerialError: (callback: (error: string) => void) => () => void;
      zoomIn: () => void;
      zoomOut: () => void;
      zoomReset: () => void;
      startLogging: () => void;
      stopLogging: () => void;
      getConfig: () => Promise<import('./index').AppConfig>;
      onLogCreationFailed: (callback: (error: string) => void) => () => void;
    };
  }
}
