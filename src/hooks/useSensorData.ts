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
        if (
          pressureLimit !== null &&
          exceedsPressureLimit(updated, pressureLimit)
        ) {
          if (++overCnt.current >= 3) {
            onEmergency();
            overCnt.current = 0;
          }
        } else {
          overCnt.current = 0;
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
  }, []);

  const getLatestSensorData = useCallback(() => sensorRef.current, []);

  return { sensorData, chartData, handleSerialMessage, reset, getLatestSensorData };
}
