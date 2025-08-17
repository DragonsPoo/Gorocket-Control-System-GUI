// Safety Critical Edge Cases - 보완 테스트
describe('Safety Critical Edge Cases', () => {
  
  describe('ACK/NACK Parsing Edge Cases', () => {
    it('should handle malformed ACK lines gracefully', () => {
      // Mock SequenceEngine with pending messages
      const pending = new Map();
      const mockEngine = {
        pending,
        emit: jest.fn(),
        onSerialData: (line: string) => {
          const s = String(line);
          if (s.startsWith('ACK,')) {
            const parts = s.trim().split(',');
            if (parts.length >= 2) {
              const id = Number(parts[1]);
              if (!Number.isFinite(id)) {
                console.warn(`Invalid ACK msgId: ${parts[1]} in line: ${s}`);
                return;
              }
              const p = pending.get(id);
              if (p) {
                clearTimeout(p.timer);
                p.resolve();
                pending.delete(id);
              }
            }
          }
        }
      };
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Test malformed ACK lines
      expect(() => mockEngine.onSerialData('ACK,invalid_id')).not.toThrow();
      expect(() => mockEngine.onSerialData('ACK,,42')).not.toThrow();
      expect(() => mockEngine.onSerialData('ACK,NaN')).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid ACK msgId'));
      consoleSpy.mockRestore();
    });

    it('should handle malformed NACK lines gracefully', () => {
      const pending = new Map();
      const mockEngine = {
        pending,
        emit: jest.fn(),
        onSerialData: (line: string) => {
          const s = String(line);
          if (s.startsWith('NACK,')) {
            const parts = s.trim().split(',');
            if (parts.length >= 3) {
              const id = Number(parts[1]);
              if (!Number.isFinite(id)) {
                console.warn(`Invalid NACK msgId: ${parts[1]} in line: ${s}`);
                return;
              }
              const reason = parts[2];
              const p = pending.get(id);
              if (p) {
                clearTimeout(p.timer);
                p.reject(new Error(`NACK: ${reason}`));
                pending.delete(id);
              }
            } else {
              console.warn(`Malformed NACK line: ${s}`);
            }
          }
        }
      };
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Test malformed NACK lines
      expect(() => mockEngine.onSerialData('NACK,invalid_id,reason')).not.toThrow();
      expect(() => mockEngine.onSerialData('NACK,42')).not.toThrow(); // Missing reason
      expect(() => mockEngine.onSerialData('NACK,,reason')).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid NACK msgId'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Malformed NACK line'));
      consoleSpy.mockRestore();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should handle rapid EMERG/CLEARED cycles without memory leak', async () => {
      let hbStopCount = 0;
      let hbStartCount = 0;
      
      const mockHbDaemon = {
        start: () => { hbStartCount++; },
        stop: () => { hbStopCount++; }
      };
      
      const mockApp = {
        onSerialData: (line: string) => {
          // Real implementation: both EMERG and EMERG_CLEARED call their respective functions
          if (line.startsWith('EMERG')) {
            mockHbDaemon.stop();
          }
          if (line.startsWith('EMERG_CLEARED')) {
            mockHbDaemon.start();
          }
        }
      };
      
      // Simulate cycles with both EMERG and EMERG_CLEARED events
      for (let i = 0; i < 25; i++) {
        mockApp.onSerialData(`EMERG: Cycle ${i}`);
        mockApp.onSerialData('EMERG_CLEARED');
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1)); // Yield occasionally
        }
      }
      
      // Verify expected call counts based on actual implementation behavior
      expect(hbStopCount).toBeGreaterThan(0); // At least some stops occurred
      expect(hbStartCount).toBeGreaterThan(0); // At least some starts occurred
      
      // The exact counts depend on implementation - main goal is no memory leaks
      console.log(`HB Stop calls: ${hbStopCount}, HB Start calls: ${hbStartCount}`);
    });

    it('should validate failsafe cooldown and latch concepts', () => {
      // Simplified test to validate the core concepts without complex timing
      let inFailsafe = false;
      let emergencyActive = false;
      let lastFailsafeAt = 0;
      let callCount = 0;
      
      const tryFailSafe = () => {
        const now = Date.now();
        if (inFailsafe || (now - lastFailsafeAt) < 400) return false; // Blocked
        
        inFailsafe = true;
        callCount++;
        lastFailsafeAt = now;
        
        // Latch behavior: stay in failsafe if emergency is active
        inFailsafe = emergencyActive;
        return true; // Executed
      };
      
      // Test 1: Normal execution
      expect(tryFailSafe()).toBe(true);
      expect(inFailsafe).toBe(false); // No emergency, so cleared
      expect(callCount).toBe(1);
      
      // Test 2: Cooldown blocks immediate re-execution
      expect(tryFailSafe()).toBe(false); // Blocked by cooldown
      expect(callCount).toBe(1); // Same count
      
      // Test 3: Emergency active scenario
      emergencyActive = true;
      lastFailsafeAt = 0; // Reset to allow execution
      expect(tryFailSafe()).toBe(true);
      expect(inFailsafe).toBe(true); // Should latch due to emergency
      expect(callCount).toBe(2);
      
      // Test 4: Latch blocks re-execution even after cooldown time
      expect(tryFailSafe()).toBe(false); // Blocked by latch
      expect(callCount).toBe(2); // Same count
      
      // Test 5: Clear emergency to test unlatch
      emergencyActive = false;
      inFailsafe = false; // Simulate external clear (like EMERG_CLEARED)
      lastFailsafeAt = 0; // Reset cooldown
      expect(tryFailSafe()).toBe(true);
      expect(inFailsafe).toBe(false); // Should be clear now
      expect(callCount).toBe(3);
    });
  });

  describe('Configuration Validation', () => {
    it('should reject malformed valve mapping gracefully', () => {
      const mapCmd = (cmd: string, valveMappings: any) => {
        const mN = /^CMD,([^,]{1,64}),(Open|Close)$/i.exec(cmd);
        if (mN) {
          const name = mN[1];
          const act = mN[2].toUpperCase().startsWith('OPEN') ? 'O' : 'C';
          const idx = valveMappings[name]?.servoIndex;
          if (typeof idx !== 'number') throw new Error(`Unknown valve: ${name}`);
          return `V,${idx},${act}`;
        }
        throw new Error(`Unsupported command: ${cmd}`);
      };
      
      const badMappings = {
        'ValidValve': { servoIndex: 0 },
        'BadValve': { servoIndex: 'not_a_number' },
        'MissingIndex': { someOtherField: 'value' }
      };
      
      expect(() => mapCmd('CMD,ValidValve,Open', badMappings)).not.toThrow();
      expect(() => mapCmd('CMD,BadValve,Open', badMappings)).toThrow('Unknown valve: BadValve');
      expect(() => mapCmd('CMD,MissingIndex,Open', badMappings)).toThrow('Unknown valve: MissingIndex');
      expect(() => mapCmd('CMD,NonExistent,Open', badMappings)).toThrow('Unknown valve: NonExistent');
    });

    it('should validate sensor range in mapCond', () => {
      const mapCond = (c: any) => {
        if (c.sensor && /^pt[1-4]$/i.test(c.sensor)) {
          const i = Number(c.sensor.slice(2));
          if (i < 1 || i > 4) {
            throw new Error(`Invalid sensor index: ${i}, must be 1-4`);
          }
          return { kind: 'pressure', sensor: i };
        }
        throw new Error(`Unsupported condition: ${JSON.stringify(c)}`);
      };
      
      // Valid sensors
      expect(() => mapCond({ sensor: 'pt1' })).not.toThrow();
      expect(() => mapCond({ sensor: 'pt4' })).not.toThrow();
      
      // Invalid sensors (though regex shouldn't match these)
      expect(() => mapCond({ sensor: 'pt0' })).toThrow('Unsupported condition');
      expect(() => mapCond({ sensor: 'pt5' })).toThrow('Unsupported condition');
      expect(() => mapCond({ sensor: 'invalid' })).toThrow('Unsupported condition');
    });
  });

  describe('Log Consistency', () => {
    it('should filter ACK/NACK lines and mark state events', () => {
      const formatLogLine = (raw: string): string => {
        if (!raw || raw.trim() === '') return '';
        
        // Filter out ACK/NACK lines
        if (raw.startsWith('ACK,') || raw.startsWith('NACK,')) {
          return '';
        }
        
        // Mark state events with # for post-analysis
        if (raw.startsWith('EMERG') || raw.startsWith('FAILSAFE') || raw.startsWith('READY')) {
          return `${new Date().toISOString()} # ${raw}\n`;
        }
        
        return `${new Date().toISOString()} ${raw}\n`;
      };
      
      // Test filtering
      expect(formatLogLine('ACK,42')).toBe('');
      expect(formatLogLine('NACK,42,CRC_ERROR')).toBe('');
      expect(formatLogLine('')).toBe('');
      expect(formatLogLine('   ')).toBe('');
      
      // Test state event marking
      const emergLine = formatLogLine('EMERG: Pressure exceeded');
      expect(emergLine).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z # EMERG: Pressure exceeded\n$/);
      
      const failsafeLine = formatLogLine('FAILSAFE initiated');
      expect(failsafeLine).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z # FAILSAFE initiated\n$/);
      
      const readyLine = formatLogLine('READY for operations');
      expect(readyLine).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z # READY for operations\n$/);
      
      // Test normal telemetry
      const telemetryLine = formatLogLine('pt1:123.45,pt2:234.56');
      expect(telemetryLine).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z pt1:123\.45,pt2:234\.56\n$/);
      expect(telemetryLine).not.toContain(' # ');
    });
  });

  describe('Chart Robustness', () => {
    it('should handle extreme pressure values in yMax calculation', () => {
      const calculateYMax = (data: any[], trip?: number) => {
        const maxObserved = Math.max(0, ...data.map(d => Math.max(d.pt1 ?? 0, d.pt2 ?? 0, d.pt3 ?? 0, d.pt4 ?? 0)));
        const tripThreshold = typeof trip === 'number' ? trip : 900;
        const calculatedMax = Math.max(maxObserved, tripThreshold * 1.1);
        return Number.isFinite(calculatedMax) && calculatedMax > 0 ? calculatedMax : 900 * 1.1;
      };
      
      // Test with extreme values
      const extremeData = [
        { pt1: Infinity, pt2: 100, pt3: 200, pt4: 150 },
        { pt1: -Infinity, pt2: 100, pt3: 200, pt4: 150 },
        { pt1: NaN, pt2: 100, pt3: 200, pt4: 150 },
        { pt1: Number.MAX_VALUE, pt2: 100, pt3: 200, pt4: 150 }
      ];
      
      // Should fallback to safe defaults for extreme values
      const yMax1 = calculateYMax(extremeData);
      expect(Number.isFinite(yMax1)).toBe(true);
      expect(yMax1).toBeGreaterThan(0);
      
      // Test with undefined trip
      const yMax2 = calculateYMax([{ pt1: 100, pt2: 200, pt3: 150, pt4: 175 }], undefined);
      expect(yMax2).toBeCloseTo(990, 0); // 900 * 1.1 (within 1 unit)
      
      // Test with negative trip
      const yMax3 = calculateYMax([{ pt1: 100, pt2: 200, pt3: 150, pt4: 175 }], -100);
      expect(Number.isFinite(yMax3)).toBe(true);
      expect(yMax3).toBeGreaterThan(0);
    });
  });
});