import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  pressureTripLimit: number | null,
  updateValves: (updates: Partial<Record<number, Partial<Valve>>>) => void
): SensorDataApi {
  const { toast } = useToast();
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

          // 알람(Alarm) 임계 초과
          const overAlarm = pressureLimit !== null ? (pNow > pressureLimit) : false;
          // 트립(Trip) 임계 초과 (GUI 테스트 중이라도 이 값에서만 failsafe 이벤트 송신)
          const overTrip = pressureTripLimit !== null ? (pNow >= pressureTripLimit) : false;

          if (overAlarm && (now - lastWarnLimitMs.current > 1000)) {
            console.warn(`Pressure limit exceeded (max PT): ${pNow} > ${pressureLimit}`);
            lastWarnLimitMs.current = now;
            try {
              toast({ title: 'Pressure Alarm', description: `Max PT ${pNow.toFixed(1)} psi > ${pressureLimit} psi`, variant: 'destructive' });
            } catch {}
          }

          // 상승률(속도) 계산: 이전 샘플 기준, 상승만 감지
          // 상승률 감시는 limit > 0일 때만 활성화
          const effectiveRateLimit = (pressureRateLimit !== null && pressureRateLimit > 0) ? pressureRateLimit : null;
          let ratePsiPerSec: number | null = null;
          let overRate = false;
          if (effectiveRateLimit !== null && prev && typeof prev.timestamp === 'number') {
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
                if (maxRate > effectiveRateLimit) {
                  overRate = true;
                  if (now - lastWarnRateMs.current > 1000) {
                    console.warn(`Pressure rate exceeded (max PT): +${maxRate.toFixed(2)} psi/s > ${effectiveRateLimit} psi/s`);
                    lastWarnRateMs.current = now;
                    try {
                      toast({ title: 'Pressure Rate Alarm', description: `+${maxRate.toFixed(2)} psi/s > ${effectiveRateLimit} psi/s`, variant: 'destructive' });
                    } catch {}
                  }
                }
              }
            }
          }

          // 라우팅: 한계/상승률 중 하나라도 초과 시 메인으로 스냅샷 송신(쿨다운 적용)
          // 안전 이벤트는 Trip 초과일 때만 송신 (Alarm/Rate는 알림만)
          const shouldEmit = (overTrip) && (now - lastSafetyEmitMs.current >= SAFETY_EMIT_COOLDOWN_MS);
          if (shouldEmit) {
            lastSafetyEmitMs.current = now;
            const reason = overAlarm && overRate ? 'limit+rate' : (overAlarm ? 'limit' : 'rate');

            const snapshot = {
              timestamp: now,
              reason,
              pressure: pNow,
              pressureLimit: pressureLimit,
              rate: ratePsiPerSec,
              rateLimit: effectiveRateLimit,   // psi/s (null 가능)
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
    [emitSafetyPressureExceeded, maxPoints, pressureLimit, pressureRateLimit, pressureTripLimit, updateValves]
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
