export function transformPayload(
  payload: string,
  valveMappings?: Record<string, { servoIndex: number; openState?: string; closedState?: string }>
): { payload: string; feedback?: { index: number; expect: 'open' | 'closed' } } {
  const trimmedPayload = payload.trim();

  // 1) SLEEP 명령 패스스루
  if (/^(SLEEP|S),(\d+)$/i.test(trimmedPayload)) {
    return { payload: trimmedPayload };
  }

  // 2) CMD,<ValveName>,(Open|Close) -> V,<idx>,O|C 로 변환
  const cmdMatch = /^CMD,([^,]+),(Open|Close)$/i.exec(trimmedPayload);
  if (cmdMatch) {
    const valveName = cmdMatch[1];
    const action = cmdMatch[2].toLowerCase();

    if (!valveMappings || !valveMappings[valveName]) {
      throw new Error(`CMD_TRANSFORM_ERROR: Valve mapping not found for valve name: ${valveName}`);
    }

    const servoIndex = valveMappings[valveName].servoIndex;
    const newPayload = `V,${servoIndex},${action === 'open' ? 'O' : 'C'}`;
    const feedbackExpect: 'open' | 'closed' = action === 'open' ? 'open' : 'closed';

    return {
      payload: newPayload,
      feedback: { index: servoIndex, expect: feedbackExpect },
    };
  }

  // 3) 그 외 원문 전달
  return { payload: trimmedPayload };
}

