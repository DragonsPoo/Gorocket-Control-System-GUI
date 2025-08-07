import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { AppConfig } from '@/types';

const configSchema = z.object({
  serial: z.object({ baudRate: z.number().int() }),
  valveMappings: z.record(z.object({ servoIndex: z.number().int() })),
  constants: z.object({
    MAX_CHART_DATA_POINTS: z.number().int(),
    PRESSURE_LIMIT: z.number().int(),
  }),
  initialValves: z.array(z.object({ id: z.number().int(), name: z.string() })),
});

export default class ConfigManager {
  static async load(filePath: string): Promise<AppConfig> {
    const resolved = path.resolve(filePath);
    const content = await fs.readFile(resolved, 'utf-8');
    const parsed = JSON.parse(content);
    return configSchema.parse(parsed) as AppConfig;
  }
}
