export function transformPayload(payload: string, valveMappings?: Record<string, {servoIndex:number, openState?:string, closedState?:string}>): {payload: string, feedback?: {index:number, expect:'open'|'closed'}} {
  const trimmedPayload = payload.trim();

  // 1) payload가 "SLEEP,<ms>" 또는 "S,<ms>"면 그대로 반환
  if (trimmedPayload.match(/^(SLEEP|S),(\d+)$/i)) {
    return { payload: trimmedPayload };
  }

  // 2) payload가 `CMD,<ValveName>,(Open|Close)` 형식이면 변환
  const cmdMatch = trimmedPayload.match(/^CMD,([^,]+),(Open|Close)$/i);
  if (cmdMatch) {
    const valveName = cmdMatch[1];
    const action = cmdMatch[2].toLowerCase();

    if (!valveMappings || !valveMappings[valveName]) {
      throw new Error(`CMD_TRANSFORM_ERROR: Valve mapping not found for valve name: ${valveName}`);
    }

    const servoIndex = valveMappings[valveName].servoIndex;
    const newPayload = `V,${servoIndex},${action === 'open' ? 'O' : 'C'}`;
    const feedbackExpect = action === 'open' ? 'open' : 'closed';

    return {
      payload: newPayload,
      feedback: {
        index: servoIndex,
        expect: feedbackExpect
      }
    };
  }

  // 3) 그 외는 원본 payload 그대로 반환
  return { payload: trimmedPayload };
}
