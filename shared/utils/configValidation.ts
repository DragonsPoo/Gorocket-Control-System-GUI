import type { AppConfig } from '../types';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 설정 파일의 압력 관련 값들을 검증합니다.
 * 필수 조건: pressureLimitAlarmPsi < pressureLimitTripPsi
 */
export function validatePressureConfig(config: AppConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 기본값 확인
  if (config.pressureLimitPsi <= 0) {
    errors.push('pressureLimitPsi must be greater than 0');
  }

  if (config.pressureLimitAlarmPsi !== undefined && config.pressureLimitAlarmPsi <= 0) {
    errors.push('pressureLimitAlarmPsi must be greater than 0');
  }

  if (config.pressureLimitTripPsi !== undefined && config.pressureLimitTripPsi <= 0) {
    errors.push('pressureLimitTripPsi must be greater than 0');
  }

  if (config.pressureRateLimitPsiPerSec !== undefined && config.pressureRateLimitPsiPerSec <= 0) {
    errors.push('pressureRateLimitPsiPerSec must be greater than 0');
  }

  // 알람 < 트립 조건 확인
  if (config.pressureLimitAlarmPsi !== undefined && config.pressureLimitTripPsi !== undefined) {
    if (config.pressureLimitAlarmPsi >= config.pressureLimitTripPsi) {
      errors.push(`pressureLimitAlarmPsi (${config.pressureLimitAlarmPsi}) must be less than pressureLimitTripPsi (${config.pressureLimitTripPsi})`);
    }
  }

  // 경고 조건들
  if (config.pressureLimitAlarmPsi === undefined) {
    warnings.push('pressureLimitAlarmPsi is not defined - no alarm threshold will be active');
  }

  if (config.pressureLimitTripPsi === undefined) {
    warnings.push('pressureLimitTripPsi is not defined - no trip threshold will be active');
  }

  if (config.pressureRateLimitPsiPerSec === undefined) {
    warnings.push('pressureRateLimitPsiPerSec is not defined - no rate-of-change monitoring');
  }

  // 단위 검증 (펌웨어와의 호환성)
  const maxReasonablePsi = 5000; // 대부분의 로켓 시스템에서 5000 PSI는 매우 높은 값
  if (config.pressureLimitTripPsi !== undefined && config.pressureLimitTripPsi > maxReasonablePsi) {
    warnings.push(`pressureLimitTripPsi (${config.pressureLimitTripPsi}) seems unusually high - verify units are in PSI, not PSI*100`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 펌웨어 형식으로 압력값을 변환합니다 (PSI * 100)
 */
export function psiToFirmwareFormat(psi: number): number {
  return Math.round(psi * 100);
}

/**
 * 펌웨어 형식에서 PSI로 변환합니다 (값 / 100)
 */
export function firmwareFormatToPsi(firmwareValue: number): number {
  return firmwareValue / 100;
}