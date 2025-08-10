import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { AppConfig } from '@shared/types';

const valveSchema = z.object({
  id: z.number(),
  name: z.string(),
  state: z.enum(['OPEN', 'CLOSED', 'OPENING', 'CLOSING', 'ERROR']),
  lsOpen: z.boolean(),
  lsClosed: z.boolean(),
});

const configSchema = z.object({
  serial: z.object({ baudRate: z.number() }),
  valveMappings: z.record(z.object({ servoIndex: z.number() })),
  maxChartDataPoints: z.number(),
  pressureLimit: z.number(),
  initialValves: z.array(valveSchema),
});

export class ConfigManager {
  private config: AppConfig | null = null;

  async load(configPath: string): Promise<AppConfig> {
    const absolute = path.resolve(configPath);
    const data = await fs.readFile(absolute, 'utf-8');
    const parsed = configSchema.parse(JSON.parse(data));
    this.config = parsed as AppConfig;
    return this.config;
  }

  get(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }
}
