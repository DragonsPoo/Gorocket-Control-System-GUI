import { useState, useRef, useCallback } from 'react';
import type { SensorData, Valve } from '@shared/types';
import {
  parseSensorData,
} from '@shared/utils/sensorParser';

export interface SensorDataApi {
  sensorData: SensorData | null;
  chartData: SensorData[];
  handleSerialMessage: (data: string) => 'EMERG' | 'CLEARED' | null;
  reset: () => void;
  getLatestSensorData: () => SensorData | null;
}

/**
 * pressureLimit: psi (예: 150)
 * pressureRateLimit: psi/s (예: 50) - 양의 상승률 기준(상승만 감지)
 */
export function useSensorData(
  maxPoints: number,
  pressureLimit: number | null,
  pressureRateLimit: number | null,
  updateValves: (updates: Partial<Record<number, Partial<Valve>>>) => void
): SensorDataApi {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const sensorRef = useRef<SensorData | null>(null);
  const [chartData, setChartData] = useState<SensorData[]>([]);

  // 라우팅/로깅 보조 상태
  const pressureHistory = useRef<number[]>([]);
  const lastWarnLimitMs = useRef(0);
  const lastWarnRateMs = useRef(0);
  const lastSafetyEmitMs = useRef(0);
  const SAFETY_EMIT_COOLDOWN_MS = 1000;

  const emitSafetyPressureExceeded = useCallback((snapshot: { timestamp: number; reason: string; pressure: number; pressureLimit: number | null; rate: number | null; rateLimit: number | null; history: number[] }) => {
    try {
      // 메인 라우팅: preload에서 ipcRenderer.send('safety:pressureExceeded', snapshot)를 노출해야 함
      (window as unknown as Record<string, { safetyPressureExceeded?: (snapshot: unknown) => void }>).electronAPI?.safetyPressureExceeded?.(snapshot);
    } catch (e) {
      console.warn('safetyPressureExceeded emit failed (no bridge?):', e);
    }
  }, []);

  const handleSerialMessage = useCallback(
    (data: string): 'EMERG' | 'CLEARED' | null => {
      if (data.startsWith('EMERG,')) return 'EMERG';
      if (data.startsWith('EMERG_CLEARED')) return 'CLEARED';

      const { sensor, valves } = parseSensorData(data);
      if (Object.keys(sensor).length > 0) {
        const now = Date.now();
        const prev = sensorRef.current ?? null;

        const updated = {
          ...sensorRef.current,
          ...sensor,
          timestamp: now,
        } as SensorData;

        // 도표/상태 반영
        setSensorData(updated);
        sensorRef.current = updated;
        setChartData((prevChart) => {
          const next = [...prevChart, updated];
          if (next.length > maxPoints) next.splice(0, next.length - maxPoints);
          return next;
        });

        // 압력/상승률 모니터링 (pt1을 대표 압력으로 사용)
        const readings = [updated.pt1, updated.pt2, updated.pt3, updated.pt4].filter((v): v is number => typeof v === 'number');
        if (readings.length > 0) {
          const pNow = Math.max(...readings);
          pressureHistory.current.push(pNow);
          if (pressureHistory.current.length > 10) pressureHistory.current.shift();

          // 한계 초과
          const overLimit = pressureLimit !== null
            ? (pNow > pressureLimit)
            : false;

          if (overLimit && (now - lastWarnLimitMs.current > 1000)) {
            console.warn(`Pressure limit exceeded (max PT): ${pNow} > ${pressureLimit}`);
            lastWarnLimitMs.current = now;
          }

          // 상승률(속도) 계산: 이전 샘플 기준, 상승만 감지
          let ratePsiPerSec: number | null = null;
          let overRate = false;
          if (pressureRateLimit !== null && prev && typeof prev.timestamp === 'number') {
            const dtMs = now - prev.timestamp;
            if (dtMs > 0) {
              const dtSec = dtMs / 1000;
              const channels: (keyof SensorData)[] = ['pt1', 'pt2', 'pt3', 'pt4'];
              const rates: number[] = [];
              for (const k of channels) {
                const cur = updated[k];
                const pv = prev[k as keyof SensorData];
                if (typeof cur === 'number' && typeof pv === 'number') {
                  rates.push((cur - pv) / dtSec);
                }
              }
              if (rates.length > 0) {
                const maxRate = Math.max(...rates);
                ratePsiPerSec = maxRate;
                if (maxRate > pressureRateLimit) {
                  overRate = true;
                  if (now - lastWarnRateMs.current > 1000) {
                    console.warn(`Pressure rate exceeded (max PT): +${maxRate.toFixed(2)} psi/s > ${pressureRateLimit} psi/s`);
                    lastWarnRateMs.current = now;
                  }
                }
              }
            }
          }

          // 라우팅: 한계/상승률 중 하나라도 초과 시 메인으로 스냅샷 송신(쿨다운 적용)
          const shouldEmit = (overLimit || overRate) && (now - lastSafetyEmitMs.current >= SAFETY_EMIT_COOLDOWN_MS);
          if (shouldEmit) {
            lastSafetyEmitMs.current = now;
            const reason = overLimit && overRate ? 'limit+rate' : (overLimit ? 'limit' : 'rate');

            const snapshot = {
              timestamp: now,
              reason,
              pressure: pNow,
              pressureLimit: pressureLimit,
              rate: ratePsiPerSec,
              rateLimit: pressureRateLimit,   // psi/s (null 가능)
              history: [...pressureHistory.current], // 최근 값
            };
            emitSafetyPressureExceeded(snapshot);
          }
        }
      }

      if (Object.keys(valves).length > 0) {
        updateValves(valves);
      }

      return null;
    },
    [emitSafetyPressureExceeded, maxPoints, pressureLimit, pressureRateLimit, updateValves]
  );

  const reset = useCallback(() => {
    setSensorData(null);
    sensorRef.current = null;
    setChartData([]);
    pressureHistory.current = [];
    lastWarnLimitMs.current = 0;
    lastWarnRateMs.current = 0;
    lastSafetyEmitMs.current = 0;
    console.log('Sensor data and pressure monitoring reset');
  }, []);

  const getLatestSensorData = useCallback(() => sensorRef.current, []);

  return { sensorData, chartData, handleSerialMessage, reset, getLatestSensorData };
}
