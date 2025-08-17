import { ConfigManager } from '../main/ConfigManager';
import { validatePressureConfig } from '@shared/utils/configValidation';
import fs from 'fs';
import path from 'path';
import { AppConfig } from '@shared/types';

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

const mockFs = fs.promises as jest.Mocked<typeof fs.promises>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
  });

  describe('load', () => {
    it('should load and validate a valid config', async () => {
      const validConfig = {
        serial: { baudRate: 115200 },
        valveMappings: {
          'System Vent': { servoIndex: 5 },
          'Ethanol Purge': { servoIndex: 2 },
          'N2O Purge': { servoIndex: 3 }
        },
        maxChartDataPoints: 100,
        pressureLimitPsi: 850,
        pressureLimitAlarmPsi: 800,
        pressureLimitTripPsi: 1000,
        pressureRateLimitPsiPerSec: 50,
        valveFeedbackTimeout: 2000,
        initialValves: []
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

      const result = await configManager.load('/mock/config.json');
      
      expect(result).toEqual(validConfig);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.resolve('/mock/config.json'),
        'utf-8'
      );
    });

    it('should reject config with alarm >= trip', async () => {
      const invalidConfig = {
        serial: { baudRate: 115200 },
        valveMappings: {},
        maxChartDataPoints: 100,
        pressureLimitPsi: 850,
        pressureLimitAlarmPsi: 1000, // >= trip
        pressureLimitTripPsi: 1000,
        initialValves: []
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.load('/mock/config.json'))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should reject config with negative pressure values', async () => {
      const invalidConfig = {
        serial: { baudRate: 115200 },
        valveMappings: {},
        maxChartDataPoints: 100,
        pressureLimitPsi: -100, // negative
        initialValves: []
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.load('/mock/config.json'))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should reject config with invalid schema', async () => {
      const invalidConfig = {
        // Missing required fields
        maxChartDataPoints: 100,
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.load('/mock/config.json'))
        .rejects.toThrow();
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(configManager.load('/mock/config.json'))
        .rejects.toThrow('File not found');
    });
  });

  describe('get', () => {
    it('should return loaded config', async () => {
      const validConfig = {
        serial: { baudRate: 115200 },
        valveMappings: {},
        maxChartDataPoints: 100,
        pressureLimitPsi: 850,
        valveFeedbackTimeout: 2000,
        initialValves: []
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      await configManager.load('/mock/config.json');

      const result = configManager.get();
      expect(result).toEqual(validConfig);
    });

    it('should throw if config not loaded', () => {
      expect(() => configManager.get()).toThrow('Configuration not loaded');
    });
  });
});

describe('validatePressureConfig', () => {
  it('should pass valid pressure config', () => {
    const config: AppConfig = {
      serial: { baudRate: 115200 },
      valveMappings: {},
      maxChartDataPoints: 100,
      pressureLimitPsi: 850,
      pressureLimitAlarmPsi: 800,
      pressureLimitTripPsi: 1000,
      pressureRateLimitPsiPerSec: 50,
      valveFeedbackTimeout: 2000,
      initialValves: []
    };

    const result = validatePressureConfig(config);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when alarm >= trip', () => {
    const config: AppConfig = {
      serial: { baudRate: 115200 },
      valveMappings: {},
      maxChartDataPoints: 100,
      pressureLimitPsi: 850,
      pressureLimitAlarmPsi: 1000,
      pressureLimitTripPsi: 1000,
      valveFeedbackTimeout: 2000,
      initialValves: []
    };

    const result = validatePressureConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('pressureLimitAlarmPsi (1000) must be less than pressureLimitTripPsi (1000)')
      ])
    );
  });

  it('should fail with negative pressure values', () => {
    const config: AppConfig = {
      serial: { baudRate: 115200 },
      valveMappings: {},
      maxChartDataPoints: 100,
      pressureLimitPsi: -100,
      valveFeedbackTimeout: 2000,
      initialValves: []
    };

    const result = validatePressureConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('pressureLimitPsi must be greater than 0');
  });

  it('should fail with zero pressure values', () => {
    const config: AppConfig = {
      serial: { baudRate: 115200 },
      valveMappings: {},
      maxChartDataPoints: 100,
      pressureLimitPsi: 0,
      pressureLimitTripPsi: 0,
      valveFeedbackTimeout: 2000,
      initialValves: []
    };

    const result = validatePressureConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('pressureLimitPsi must be greater than 0');
    expect(result.errors).toContain('pressureLimitTripPsi must be greater than 0');
  });

  it('should warn about missing optional fields', () => {
    const config: AppConfig = {
      serial: { baudRate: 115200 },
      valveMappings: {},
      maxChartDataPoints: 100,
      pressureLimitPsi: 850,
      valveFeedbackTimeout: 2000,
      initialValves: []
    };

    const result = validatePressureConfig(config);
    
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('pressureLimitAlarmPsi is not defined - no alarm threshold will be active');
    expect(result.warnings).toContain('pressureLimitTripPsi is not defined - no trip threshold will be active');
    expect(result.warnings).toContain('pressureRateLimitPsiPerSec is not defined - no rate-of-change monitoring');
  });

  it('should warn about unusually high pressure values', () => {
    const config: AppConfig = {
      serial: { baudRate: 115200 },
      valveMappings: {},
      maxChartDataPoints: 100,
      pressureLimitPsi: 850,
      pressureLimitTripPsi: 10000, // Very high
      valveFeedbackTimeout: 2000,
      initialValves: []
    };

    const result = validatePressureConfig(config);
    
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('pressureLimitTripPsi (10000) seems unusually high')
      ])
    );
  });
});