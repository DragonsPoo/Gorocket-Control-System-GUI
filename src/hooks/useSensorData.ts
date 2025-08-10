import { useState, useRef, useCallback } from 'react';
import type { SensorData, Valve } from '@shared/types';
import { parseSensorData, exceedsPressureLimit } from '@/utils/sensorParser';

export interface SensorDataApi {
  sensorData: SensorData | null;
  chartData: SensorData[];
  handleSerialMessage: (data: string) => void;
  reset: () => void;
}

export function useSensorData(
  maxPoints: number,
  pressureLimit: number,
  onEmergency: () => void,
  updateValves: (updates: Partial<Record<number, Partial<Valve>>>) => void
): SensorDataApi {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const sensorRef = useRef<SensorData | null>(null);
  const [chartData, setChartData] = useState<SensorData[]>([]);

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
        setChartData((prev) => [...prev, updated].slice(-maxPoints));
        if (exceedsPressureLimit(updated, pressureLimit)) {
          onEmergency();
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

  return { sensorData, chartData, handleSerialMessage, reset };
}
