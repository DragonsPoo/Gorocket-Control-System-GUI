import { useState, useRef, useCallback } from 'react';
import type { SensorData, Valve } from '@shared/types';
import {
  parseSensorData,
  exceedsPressureLimit,
} from '@shared/utils/sensorParser';

export interface SensorDataApi {
  sensorData: SensorData | null;
  chartData: SensorData[];
  handleSerialMessage: (data: string) => void;
  reset: () => void;
  getLatestSensorData: () => SensorData | null;
}

export function useSensorData(
  maxPoints: number,
  pressureLimit: number | null,
  onEmergency: () => void,
  updateValves: (updates: Partial<Record<number, Partial<Valve>>>) => void
): SensorDataApi {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const sensorRef = useRef<SensorData | null>(null);
  const [chartData, setChartData] = useState<SensorData[]>([]);
  const overCnt = useRef(0);
  const emergencyTriggeredRef = useRef(false);
  const lastPressureWarning = useRef(0);
  const pressureHistory = useRef<number[]>([]);

  const handleSerialMessage = useCallback(
    (data: string) => {
      const { sensor, valves } = parseSensorData(data);
      if (Object.keys(sensor).length > 0) {
        const updated = {
          ...sensorRef.current,
          ...sensor,
          timestamp: Date.now(),
        } as SensorData;
        setSensorData(updated);
        sensorRef.current = updated;
        setChartData((prev) => {
          const next = [...prev, updated];
          if (next.length > maxPoints) next.splice(0, next.length - maxPoints);
          return next;
        });
        // 압력 한계 검사 및 안정화된 처리
        if (pressureLimit !== null && typeof updated.pressure === 'number') {
          const currentPressure = updated.pressure;
          const now = Date.now();
          
          // 압력 히스토리 유지 (최근 10개 값)
          pressureHistory.current.push(currentPressure);
          if (pressureHistory.current.length > 10) {
            pressureHistory.current.shift();
          }
          
          const exceedsLimit = exceedsPressureLimit(updated, pressureLimit);
          
          if (exceedsLimit) {
            overCnt.current++;
            
            // 경고 로깅 (주기적으로 방지)
            if (now - lastPressureWarning.current > 1000) {
              console.warn(`Pressure warning ${overCnt.current}/3: ${currentPressure} > ${pressureLimit}`);
              lastPressureWarning.current = now;
            }
            
            // 3회 연속 초과 시 비상 상황
            if (overCnt.current >= 3 && !emergencyTriggeredRef.current) {
              emergencyTriggeredRef.current = true;
              
              // 압력 히스토리 분석
              const avgPressure = pressureHistory.current.reduce((a, b) => a + b, 0) / pressureHistory.current.length;
              const maxPressure = Math.max(...pressureHistory.current);
              
              console.error(`EMERGENCY TRIGGERED: Pressure limit exceeded 3 times`);
              console.error(`Current: ${currentPressure}, Limit: ${pressureLimit}`);
              console.error(`Recent average: ${avgPressure.toFixed(2)}, Max: ${maxPressure.toFixed(2)}`);
              
              onEmergency();
              overCnt.current = 0;
              
              // 5초 후 비상 상황 리셋 (안정화 후 재감지 가능)
              setTimeout(() => {
                emergencyTriggeredRef.current = false;
                console.log('Emergency state reset - pressure monitoring resumed');
              }, 5000);
            }
          } else {
            // 압력이 정상 범위로 돌아온 경우
            if (overCnt.current > 0) {
              console.log(`Pressure normalized: ${currentPressure} <= ${pressureLimit} (warning count reset)`);
            }
            overCnt.current = 0;
          }
        }
      }
      if (Object.keys(valves).length > 0) {
        updateValves(valves);
      }
    },
    [maxPoints, onEmergency, pressureLimit, updateValves]
  );

  const reset = useCallback(() => {
    setSensorData(null);
    sensorRef.current = null;
    setChartData([]);
    overCnt.current = 0;
    emergencyTriggeredRef.current = false;
    pressureHistory.current = [];
    console.log('Sensor data and pressure monitoring reset');
  }, []);

  const getLatestSensorData = useCallback(() => sensorRef.current, []);

  return { sensorData, chartData, handleSerialMessage, reset, getLatestSensorData };
}
