import { useReducer, useCallback } from 'react';
import type { Valve } from '@/types';

interface SetAction {
  type: 'SET';
  valves: Valve[];
}

interface UpdateAction {
  type: 'UPDATE';
  id: number;
  updates: Partial<Valve>;
}

type Action = SetAction | UpdateAction;

function reducer(state: Valve[], action: Action): Valve[] {
  switch (action.type) {
    case 'SET':
      return action.valves;
    case 'UPDATE':
      return state.map((v) => (v.id === action.id ? { ...v, ...action.updates } : v));
    default:
      return state;
  }
}

export function useValveControl(initial: Valve[]) {
  const [valves, dispatch] = useReducer(reducer, initial);

  const setValves = useCallback((vals: Valve[]) => dispatch({ type: 'SET', valves: vals }), []);
  const updateValve = useCallback(
    (id: number, updates: Partial<Valve>) => dispatch({ type: 'UPDATE', id, updates }),
    []
  );

  return { valves, setValves, updateValve };
}
