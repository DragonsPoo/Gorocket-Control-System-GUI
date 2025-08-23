// shared/utils/sensorParser.ts
import type { SensorData, Valve } from '@shared/types';

export interface ParsedSensorData {
  sensor: Partial<SensorData>;
  valves: Partial<Record<number, Partial<Valve>>>;
  errors: string[];
}

// CRC-8 (poly=0x07, init=0x00, no-reflect, xorout=0x00) - Lookup table version to match Arduino
const CRC8_TABLE = [
  0x00,0x07,0x0E,0x09,0x1C,0x1B,0x12,0x15,0x38,0x3F,0x36,0x31,0x24,0x23,0x2A,0x2D,
  0x70,0x77,0x7E,0x79,0x6C,0x6B,0x62,0x65,0x48,0x4F,0x46,0x41,0x54,0x53,0x5A,0x5D,
  0xE0,0xE7,0xEE,0xE9,0xFC,0xFB,0xF2,0xF5,0xD8,0xDF,0xD6,0xD1,0xC4,0xC3,0xCA,0xCD,
  0x90,0x97,0x9E,0x99,0x8C,0x8B,0x82,0x85,0xA8,0xAF,0xA6,0xA1,0xB4,0xB3,0xBA,0xBD,
  0xC7,0xC0,0xC9,0xCE,0xDB,0xDC,0xD5,0xD2,0xFF,0xF8,0xF1,0xF6,0xE3,0xE4,0xED,0xEA,
  0xB7,0xB0,0xB9,0xBE,0xAB,0xAC,0xA5,0xA2,0x8F,0x88,0x81,0x86,0x93,0x94,0x9D,0x9A,
  0x27,0x20,0x29,0x2E,0x3B,0x3C,0x35,0x32,0x1F,0x18,0x11,0x16,0x03,0x04,0x0D,0x0A,
  0x57,0x50,0x59,0x5E,0x4B,0x4C,0x45,0x42,0x6F,0x68,0x61,0x66,0x73,0x74,0x7D,0x7A,
  0x89,0x8E,0x87,0x80,0x95,0x92,0x9B,0x9C,0xB1,0xB6,0xBF,0xB8,0xAD,0xAA,0xA3,0xA4,
  0xF9,0xFE,0xF7,0xF0,0xE5,0xE2,0xEB,0xEC,0xC1,0xC6,0xCF,0xC8,0xDD,0xDA,0xD3,0xD4,
  0x69,0x6E,0x67,0x60,0x75,0x72,0x7B,0x7C,0x51,0x56,0x5F,0x58,0x4D,0x4A,0x43,0x44,
  0x19,0x1E,0x17,0x10,0x05,0x02,0x0B,0x0C,0x21,0x26,0x2F,0x28,0x3D,0x3A,0x33,0x34,
  0x4E,0x49,0x40,0x47,0x52,0x55,0x5C,0x5B,0x76,0x71,0x78,0x7F,0x6A,0x6D,0x64,0x63,
  0x3E,0x39,0x30,0x37,0x22,0x25,0x2C,0x2B,0x06,0x01,0x08,0x0F,0x1A,0x1D,0x14,0x13,
  0xAE,0xA9,0xA0,0xA7,0xB2,0xB5,0xBC,0xBB,0x96,0x91,0x98,0x9F,0x8A,0x8D,0x84,0x83,
  0xDE,0xD9,0xD0,0xD7,0xC2,0xC5,0xCC,0xCB,0xE6,0xE1,0xE8,0xEF,0xFA,0xFD,0xF4,0xF3
];

function crc8(bytes: ArrayLike<number>): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC8_TABLE[crc ^ (bytes[i] & 0xFF)];
  }
  return crc;
}

// Calculates CRC8 directly from a string's char codes, using lookup table to match Arduino
function crc8OfString(input: string): number {
  let crc = 0;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i) & 0xFF;
    crc = CRC8_TABLE[crc ^ byte];
  }
  return crc;
}

// System messages that are sent without a CRC checksum.
const SYSTEM_PREFIXES = ['VACK', 'VERR', 'PONG', 'BOOT', 'READY', 'EMERG', 'EMERG_CLEARED', 'ACK', 'NACK'];

export function parseSensorData(raw: string): ParsedSensorData {
  const errors: string[] = [];
  const sensor: Partial<SensorData> = {};
  const valves: Partial<Record<number, Partial<Valve>>> = {};

  // Trim trailing newlines/carriage returns before processing.
  const line = raw.replace(/[\r\n]+$/, '');

  // Ignore system messages immediately. They don't contain sensor data and don't have a CRC.
  const trimmedLine = line.trim();
  if (SYSTEM_PREFIXES.some(msg => trimmedLine.startsWith(msg))) {
    return { sensor, valves, errors };
  }

  // --- CRC Validation (expects ",XX" at the end of the line) ---
  const crcMatch = line.match(/^(.*),([0-9a-fA-F]{1,2})$/);

  if (!crcMatch) {
    const msg = `Telemetry integrity error: No CRC found in "${line}"`;
    errors.push(msg);
    console.error(msg);
    // Fallback: try to parse valve LS states even if CRC is missing
    const m2 = /(?:^|,)V(\d+)_LS_(OPEN|CLOSED):([01])/g;
    let mm: RegExpExecArray | null;
    while ((mm = m2.exec(line)) !== null) {
      const valveId = parseInt(mm[1], 10) + 1; // 1-indexed for UI
      const which = mm[2] as 'OPEN' | 'CLOSED';
      const bit = mm[3] === '1';
      if (!valves[valveId]) valves[valveId] = {};
      if (which === 'OPEN') (valves[valveId]!).lsOpen = bit; else (valves[valveId]!).lsClosed = bit;
    }
    return { sensor, valves, errors };
  }

  const dataPart = crcMatch[1];
  const receivedCrc = parseInt(crcMatch[2], 16);
  const calculatedCrc = crc8OfString(dataPart);

  if ((receivedCrc & 0xFF) !== calculatedCrc) {
    // SAFETY: Fixed CRC mismatch log message formatting
    const msg = `Telemetry integrity error: CRC mismatch. Data="${dataPart}", received=${receivedCrc}, calculated=${calculatedCrc}`;
    errors.push(msg);
    console.error(msg);
    // Fallback: still parse valve LS states from the untrusted payload to keep UI status usable.
    const m2 = /(?:^|,)V(\d+)_LS_(OPEN|CLOSED):([01])/g;
    let mm: RegExpExecArray | null;
    while ((mm = m2.exec(dataPart)) !== null) {
      const valveId = parseInt(mm[1], 10) + 1;
      const which = mm[2] as 'OPEN' | 'CLOSED';
      const bit = mm[3] === '1';
      if (!valves[valveId]) valves[valveId] = {};
      if (which === 'OPEN') (valves[valveId]!).lsOpen = bit; else (valves[valveId]!).lsClosed = bit;
    }
    return { sensor, valves, errors };
  }
  // --- CRC validation passed: proceed with parsing the dataPart ---

  // Sensor packets may contain valve-only fields or appear in any order.
  // As long as CRC is valid, proceed to parse without enforcing a fixed prefix.

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
    (data.pt1 ?? 0) > limit ||
    (data.pt2 ?? 0) > limit ||
    (data.pt3 ?? 0) > limit ||
    (data.pt4 ?? 0) > limit
  );
}
