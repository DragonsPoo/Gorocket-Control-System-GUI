import type { SensorData, Valve } from '@/types';

export interface ParsedSerialData {
  sensors: Partial<SensorData>;
  valves: Record<number, Partial<Valve>>;
}

const sensorKeys: (keyof SensorData)[] = [
  'pt1',
  'pt2',
  'pt3',
  'pt4',
  'flow1',
  'flow2',
  'tc1',
  'timestamp',
];

export function parseSensorPacket(data: string): ParsedSerialData {
  const parts = data.split(',');
  const sensors: Partial<SensorData> = {};
  const valves: Record<number, Partial<Valve>> = {};

  parts.forEach((part) => {
    const [key, rawValue] = part.split(':');
    if (!key || !rawValue) return;
    const value = rawValue.trim();

    if (sensorKeys.includes(key as keyof SensorData)) {
      (sensors as any)[key] = parseFloat(value);
    }

    const match = key.match(/V(\d)(LS_OPEN|LS_CLOSED)/);
    if (match) {
      const valveId = parseInt(match[1], 10);
      const lsType = match[2];
      const lsValue = value === '1';
      if (!valves[valveId]) valves[valveId] = {};
      if (lsType === 'LS_OPEN') valves[valveId]!.lsOpen = lsValue;
      if (lsType === 'LS_CLOSED') valves[valveId]!.lsClosed = lsValue;
    }
  });

  return { sensors, valves };
}

export function isEmergency(data: SensorData, limit: number): boolean {
  return data.pt1 > limit || data.pt2 > limit;
}
