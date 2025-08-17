// shared/utils/sensorParser.ts
import type { SensorData, Valve } from '@shared/types';

export interface ParsedSensorData {
  sensor: Partial<SensorData>;
  valves: Partial<Record<number, Partial<Valve>>>;
  errors: string[];
}

// CRC-8 (poly=0x07, init=0x00, no-reflect, xorout=0x00)
// Note: This function is for ArrayLike<number> (e.g., Buffer) but we'll use the string-specific one for compatibility.
function crc8(bytes: ArrayLike<number>): number {
  let crc = 0x00;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] & 0xFF;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
    }
  }
  return crc & 0xFF;
}

// Calculates CRC8 directly from a string's char codes, avoiding Buffer dependency for browser compatibility.
function crc8OfString(input: string): number {
  let crc = 0x00;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i) & 0xFF;
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
    }
  }
  return crc & 0xFF;
}

// System messages that are sent without a CRC checksum.
const SYSTEM_PREFIXES = ['VACK', 'VERR', 'PONG', 'BOOT', 'READY', 'EMERG_CLEARED'];

export function parseSensorData(raw: string): ParsedSensorData {
  const errors: string[] = [];
  const sensor: Partial<SensorData> = {};
  const valves: Partial<Record<number, Partial<Valve>>> = {};

  // Trim trailing newlines/carriage returns before processing.
  const line = raw.replace(/[\r\n]+$/, '');

  // Ignore system messages immediately. They don't contain sensor data and don't have a CRC.
  if (SYSTEM_PREFIXES.some(msg => line.startsWith(msg))) {
    return { sensor, valves, errors };
  }

  // --- CRC Validation (expects ",XX" at the end of the line) ---
  const crcMatch = line.match(/^(.*),([0-9a-fA-F]{2})$/);

  if (!crcMatch) {
    const msg = `Telemetry integrity error: No CRC found in "${line}"`;
    errors.push(msg);
    console.error(msg);
    // Discard data if CRC is missing.
    return { sensor, valves, errors };
  }

  const dataPart = crcMatch[1];
  const receivedCrc = parseInt(crcMatch[2], 16);
  const calculatedCrc = crc8OfString(dataPart);

  if ((receivedCrc & 0xFF) !== calculatedCrc) {
    const msg = `Telemetry integrity error: CRC mismatch. Data: "${dataPart}", Received: ${receivedCrc}, Calculated: ${calculatedCrc}`;
    errors.push(msg);
    console.error(msg);
    // Discard data on CRC failure.
    return { sensor, valves, errors };
  }
  // --- CRC validation passed: proceed with parsing the dataPart ---

  const parts = dataPart.split(',');

  if (parts.length === 0) {
    const msg = `Invalid sensor data: ${dataPart}`;
    errors.push(msg);
    console.error(msg);
    return { sensor, valves, errors };
  }

  parts.forEach((part) => {
    const [key, rawValue] = part.split(':');
    if (!key || rawValue === undefined || rawValue === '') {
      const msg = `Malformed sensor data segment: ${part}`;
      errors.push(msg);
      console.error(msg);
      return;
    }

    const value = rawValue.trim();

    // Valve limit switch state: V{idx}_LS_{OPEN|CLOSED}
    const lsMatch = key.match(/^V(\d+)_LS_(OPEN|CLOSED)$/);
    if (lsMatch) {
      const valveId = parseInt(lsMatch[1], 10) + 1; // Hardware is 0-indexed, UI is 1-indexed
      const lsType = lsMatch[2];
      const lsValue = value === '1';
      if (!valves[valveId]) valves[valveId] = {};
      if (lsType === 'OPEN') (valves[valveId]!).lsOpen = lsValue;
      if (lsType === 'CLOSED') (valves[valveId]!).lsClosed = lsValue;
      return;
    }

    // Special case: TC1, TC2 can be error strings
    if (key === 'tc1' || key === 'tc2') {
      const num = parseFloat(value);
      (sensor as Record<string, number | string>)[key] = !Number.isNaN(num) ? num : value;
      return;
    }

    // Flow rate mapping
    if (key === 'fm1_Lh') {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) (sensor as Record<string, number>)['flow1'] = num;
      return;
    }
    if (key === 'fm2_Lh') {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) (sensor as Record<string, number>)['flow2'] = num;
      return;
    }

    // Default: parse as a number
    const num = parseFloat(value);
    if (Number.isNaN(num)) {
      const msg = `Invalid numeric value for ${key}: ${value}`;
      errors.push(msg);
      console.error(msg);
      return;
    }
    (sensor as Record<string, number>)[key] = num;
  });

  return { sensor, valves, errors };
}

export function exceedsPressureLimit(data: SensorData, limit: number): boolean {
  return (
    data.pt1 > limit ||
    data.pt2 > limit ||
    data.pt3 > limit ||
    data.pt4 > limit
  );
}
