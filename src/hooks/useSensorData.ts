import { useReducer, useRef, useCallback } from 'react';
import { parseSensorPacket, isEmergency } from '@/utils/sensorParser';
import type { SensorData } from '@/types';

interface SensorState {
  sensorData: SensorData | null;
  chartData: SensorData[];
}

interface SetAction {
  type: 'SET';
  data: SensorData;
}

interface AddChartAction {
  type: 'ADD_CHART';
  data: SensorData;
  maxPoints: number;
}

interface ResetAction {
  type: 'RESET';
}

type Action = SetAction | AddChartAction | ResetAction;

function reducer(state: SensorState, action: Action): SensorState {
  switch (action.type) {
    case 'SET':
      return { ...state, sensorData: action.data };
    case 'ADD_CHART':
      return {
        ...state,
        chartData: [...state.chartData, action.data].slice(-action.maxPoints),
      };
    case 'RESET':
      return { sensorData: null, chartData: [] };
    default:
      return state;
  }
}

export function useSensorData(
  limit: number,
  maxPoints: number,
  onEmergency: (data: SensorData) => void
) {
  const [state, dispatch] = useReducer(reducer, { sensorData: null, chartData: [] });
  const sensorRef = useRef<SensorData | null>(null);

  const handleRawData = useCallback(
    (raw: string) => {
      const { sensors } = parseSensorPacket(raw);
      if (Object.keys(sensors).length === 0) return;
      const updated = { ...sensorRef.current, ...sensors, timestamp: Date.now() } as SensorData;
      dispatch({ type: 'SET', data: updated });
      dispatch({ type: 'ADD_CHART', data: updated, maxPoints });
      sensorRef.current = updated;
      if (isEmergency(updated, limit)) onEmergency(updated);
    },
    [limit, maxPoints, onEmergency]
  );

  return { ...state, handleRawData, reset: () => dispatch({ type: 'RESET' }) };
}
