import { transformPayload } from '../main/cmdTransform';

describe('transformPayload', () => {
  const mockValveMappings = {
    "Ethanol Main": { servoIndex: 3 },
    "N2O Main": { servoIndex: 4 },
    "System Vent": { servoIndex: 5 },
  };

  it('should transform CMD,ValveName,Open to V,index,O', () => {
    const result = transformPayload('CMD,Ethanol Main,Open', mockValveMappings);
    expect(result.payload).toBe('V,3,O');
    expect(result.feedback).toEqual({ index: 3, expect: 'open' });
  });

  it('should transform CMD,ValveName,Close to V,index,C', () => {
    const result = transformPayload('CMD,N2O Main,Close', mockValveMappings);
    expect(result.payload).toBe('V,4,C');
    expect(result.feedback).toEqual({ index: 4, expect: 'closed' });
  });

  it('should return original payload for V commands', () => {
    const result = transformPayload('V,0,O', mockValveMappings);
    expect(result.payload).toBe('V,0,O');
    expect(result.feedback).toBeUndefined();
  });

  it('should return original payload for SLEEP commands', () => {
    const result = transformPayload('SLEEP,1000', mockValveMappings);
    expect(result.payload).toBe('SLEEP,1000');
    expect(result.feedback).toBeUndefined();
  });

  it('should return original payload for S commands', () => {
    const result = transformPayload('S,500', mockValveMappings);
    expect(result.payload).toBe('S,500');
    expect(result.feedback).toBeUndefined();
  });

  it('should throw error for unknown valve name in CMD command', () => {
    expect(() => transformPayload('CMD,Unknown Valve,Open', mockValveMappings)).toThrow('CMD_TRANSFORM_ERROR: Valve mapping not found for valve name: Unknown Valve');
  });

  it('should return original payload for other raw commands', () => {
    const result = transformPayload('SOME_RAW_COMMAND', mockValveMappings);
    expect(result.payload).toBe('SOME_RAW_COMMAND');
    expect(result.feedback).toBeUndefined();
  });
});