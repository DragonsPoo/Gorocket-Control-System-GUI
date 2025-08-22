import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { AppConfig } from '@shared/types';
import { validatePressureConfig } from '@shared/utils/configValidation';

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
  // Canonical fields
  pressureLimitAlarmPsi: z.number(),
  pressureLimitTripPsi: z.number().optional(),
  pressureRateLimitPsiPerSec: z.number().optional(),
  valveFeedbackTimeout: z.number().optional().default(2000),
  initialValves: z.array(valveSchema),
});

export class ConfigManager {
  private config: AppConfig | null = null;

  async load(configPath: string): Promise<AppConfig> {
    const absolute = path.resolve(configPath);
    const data = await fs.readFile(absolute, 'utf-8');
    const raw = JSON.parse(data);
    const parsed = configSchema.parse(raw);
    
    // 압력 관련 설정 검증
    const validation = validatePressureConfig(parsed as AppConfig);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 경고가 있으면 콘솔에 출력
    if (validation.warnings.length > 0) {
      console.warn('Configuration warnings:', validation.warnings);
    }
    
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
