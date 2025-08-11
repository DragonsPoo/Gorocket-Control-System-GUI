import type { SensorData, Valve } from '@shared/types';

export interface ParsedSensorData {
  sensor: Partial<SensorData>;
  valves: Partial<Record<number, Partial<Valve>>>;
  errors: string[];
}

export function parseSensorData(raw: string): ParsedSensorData {
  const parts = raw.split(',');
  const sensor: Partial<SensorData> = {};
  const valves: Partial<Record<number, Partial<Valve>>> = {};
  const errors: string[] = [];

  if (parts.length === 0) {
    const msg = `Invalid sensor data: ${raw}`;
    errors.push(msg);
    console.error(msg);
    return { sensor, valves, errors };
  }

  parts.forEach((part) => {
    const [key, rawValue] = part.split(':');
    if (!key || rawValue === undefined) {
      const msg = `Malformed sensor data segment: ${part}`;
      errors.push(msg);
      console.error(msg);
      return;
    }
    const value = rawValue.trim();
    const match = key.match(/^V(\d+)_LS_(OPEN|CLOSED)$/);
    if (match) {
      const valveId = parseInt(match[1], 10) + 1;
      const lsType = match[2];
      const lsValue = value === '1';
      if (!valves[valveId]) valves[valveId] = {};
      if (lsType === 'OPEN') valves[valveId]!.lsOpen = lsValue;
      if (lsType === 'CLOSED') valves[valveId]!.lsClosed = lsValue;
      return;
    }
    if (key === 'tc1' || key === 'tc2') {
      const num = parseFloat(value);
      (sensor as Record<string, number | string>)[key] = !Number.isNaN(num)
        ? num
        : value;
      return;
    }

    // Handle flow rate mapping
    if (key === 'fm1_Lh') {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        (sensor as Record<string, number>)['flow1'] = num;
      }
      return;
    }
    if (key === 'fm2_Lh') {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        (sensor as Record<string, number>)['flow2'] = num;
      }
      return;
    }

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

