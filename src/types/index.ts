export interface ValveMappingEntry {
  driver: number;
  channel: number;
}

export interface AppConfig {
  serial: {
    baudRate: number;
  };
  valveToMotorMapping: Record<string, ValveMappingEntry>;
}
