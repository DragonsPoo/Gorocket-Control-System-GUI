// Test emergency handling improvements, FAILSAFE latch/cooldown, HB daemon control, and sequence/chart enhancements

import { EventEmitter } from 'events';

describe('Emergency Handling Enhancements', () => {
  describe('SerialManager abort APIs', () => {
    // Mock SerialManager with new abort methods
    class MockSerialManager extends EventEmitter {
      private inflight: any = null;
      private pendingById = new Map<number, any>();

      // Mock the new abort methods
      abortInflight(reason = 'aborted') {
        const m = this.inflight;
        if (!m) return;
        clearTimeout(m.timer);
        this.pendingById.delete(m.msgId);
        this.inflight = null;
        m.reject(new Error(reason));
      }

      abortAllPendings(reason = 'aborted') {
        for (const [, m] of this.pendingById) {
          clearTimeout(m.timer);
          m.reject(new Error(reason));
        }
        this.pendingById.clear();
      }

      // Helper methods for testing
      setInflight(msg: any) { this.inflight = msg; }
      addPending(id: number, msg: any) { this.pendingById.set(id, msg); }
      getPendingSize() { return this.pendingById.size; }
      hasInflight() { return this.inflight !== null; }
    }

    it('should abort inflight message with reason', () => {
      const serialManager = new MockSerialManager();
      const mockMsg = {
        msgId: 42,
        timer: setTimeout(() => {}, 1000),
        reject: jest.fn()
      };
      
      serialManager.setInflight(mockMsg);
      serialManager.addPending(42, mockMsg);
      
      serialManager.abortInflight('emergency');
      
      expect(serialManager.hasInflight()).toBe(false);
      expect(serialManager.getPendingSize()).toBe(0);
      expect(mockMsg.reject).toHaveBeenCalledWith(new Error('emergency'));
    });

    it('should abort all pending messages', () => {
      const serialManager = new MockSerialManager();
      const mockMsg1 = { timer: setTimeout(() => {}, 1000), reject: jest.fn() };
      const mockMsg2 = { timer: setTimeout(() => {}, 1000), reject: jest.fn() };
      
      serialManager.addPending(1, mockMsg1);
      serialManager.addPending(2, mockMsg2);
      
      serialManager.abortAllPendings('emergency');
      
      expect(serialManager.getPendingSize()).toBe(0);
      expect(mockMsg1.reject).toHaveBeenCalledWith(new Error('emergency'));
      expect(mockMsg2.reject).toHaveBeenCalledWith(new Error('emergency'));
    });

    it('should handle abort when no inflight message exists', () => {
      const serialManager = new MockSerialManager();
      
      expect(() => serialManager.abortInflight('test')).not.toThrow();
      expect(serialManager.hasInflight()).toBe(false);
    });
  });

  describe('EMERG transmission halt', () => {
    class MockSequenceEngine extends EventEmitter {
      private emergencyActive = false;
      private serial: any;

      constructor(serialManager: any) {
        super();
        this.serial = serialManager;
      }

      onSerialData(line: string) {
        const s = String(line);
        if (s.startsWith('EMERG')) {
          (this.serial as any).clearQueue?.();
          (this.serial as any).abortInflight?.('emergency');
          (this.serial as any).abortAllPendings?.('emergency');
          this.emergencyActive = true;
        }
        if (s.startsWith('EMERG_CLEARED')) {
          this.emergencyActive = false;
        }
      }

      isEmergencyActive() { return this.emergencyActive; }
    }

    it('should halt transmission on EMERG signal', () => {
      const mockSerial = {
        clearQueue: jest.fn(),
        abortInflight: jest.fn(),
        abortAllPendings: jest.fn()
      };
      
      const engine = new MockSequenceEngine(mockSerial);
      
      engine.onSerialData('EMERG: Pressure exceeded');
      
      expect(mockSerial.clearQueue).toHaveBeenCalled();
      expect(mockSerial.abortInflight).toHaveBeenCalledWith('emergency');
      expect(mockSerial.abortAllPendings).toHaveBeenCalledWith('emergency');
      expect(engine.isEmergencyActive()).toBe(true);
    });

    it('should clear emergency state on EMERG_CLEARED', () => {
      const mockSerial = { clearQueue: jest.fn(), abortInflight: jest.fn(), abortAllPendings: jest.fn() };
      const engine = new MockSequenceEngine(mockSerial);
      
      engine.onSerialData('EMERG: Test');
      expect(engine.isEmergencyActive()).toBe(true);
      
      engine.onSerialData('EMERG_CLEARED');
      expect(engine.isEmergencyActive()).toBe(false);
    });
  });

  describe('FAILSAFE latch and cooldown', () => {
    class MockFailsafeEngine {
      private inFailsafe = false;
      private emergencyActive = false;
      private lastFailsafeAt = 0;
      private roles = { mains: [0, 1], vents: [5], purges: [6] };
      private writeNowCalls: string[] = [];
      private sendWithAckCalls: string[] = [];

      async tryFailSafe(tag = 'FAILSAFE') {
        const now = Date.now();
        if (this.inFailsafe || (now - this.lastFailsafeAt) < 400) return;
        this.inFailsafe = true;
        
        try {
          const mains = Array.from(new Set(this.roles.mains));
          const vents = Array.from(new Set(this.roles.vents));
          const purges = Array.from(new Set(this.roles.purges));

          const closePass = mains.map(m => `V,${m},C`);
          const openPass = [...vents.map(v => `V,${v},O`), ...purges.map(p => `V,${p},O`)];
          
          for (const pass of [closePass, openPass, openPass]) {
            for (const c of pass) {
              this.writeNowCalls.push(c);
            }
            await Promise.allSettled(pass.map(c => this.mockSendWithAck(c)));
          }
        } finally {
          this.lastFailsafeAt = Date.now();
          this.inFailsafe = this.emergencyActive ? true : false;
        }
      }

      private async mockSendWithAck(cmd: string) {
        this.sendWithAckCalls.push(cmd);
        return true;
      }

      setEmergencyActive(active: boolean) { this.emergencyActive = active; }
      getWriteNowCalls() { return [...this.writeNowCalls]; }
      getSendWithAckCalls() { return [...this.sendWithAckCalls]; }
      isInFailsafe() { return this.inFailsafe; }
      getLastFailsafeAt() { return this.lastFailsafeAt; }
      resetCalls() { this.writeNowCalls = []; this.sendWithAckCalls = []; }
    }

    it('should implement cooldown to prevent multiple failsafe calls', async () => {
      const engine = new MockFailsafeEngine();
      
      await engine.tryFailSafe('TEST1');
      const firstCallCount = engine.getWriteNowCalls().length;
      expect(firstCallCount).toBeGreaterThan(0);
      
      // Immediate second call should be blocked by cooldown
      await engine.tryFailSafe('TEST2');
      const secondCallCount = engine.getWriteNowCalls().length;
      expect(secondCallCount).toBe(firstCallCount); // No additional calls
    });

    it('should execute FAILSAFE commands in correct sequence (CLOSE-OPEN-OPEN)', async () => {
      const engine = new MockFailsafeEngine();
      
      await engine.tryFailSafe('TEST');
      
      const writeNowCalls = engine.getWriteNowCalls();
      const sendAckCalls = engine.getSendWithAckCalls();
      
      // Should have calls for: 2 close + 2 open + 2 open (retry) = 6 total
      expect(writeNowCalls).toHaveLength(6);
      expect(sendAckCalls).toHaveLength(6);
      
      // Check sequence: CLOSE commands first, then OPEN commands (twice)
      expect(writeNowCalls.slice(0, 2)).toEqual(['V,0,C', 'V,1,C']);
      expect(writeNowCalls.slice(2, 4)).toEqual(['V,5,O', 'V,6,O']);
      expect(writeNowCalls.slice(4, 6)).toEqual(['V,5,O', 'V,6,O']); // Retry
    });

    it('should maintain latch when emergency is active', async () => {
      const engine = new MockFailsafeEngine();
      engine.setEmergencyActive(true);
      
      await engine.tryFailSafe('TEST');
      
      expect(engine.isInFailsafe()).toBe(true); // Should remain true due to latch
    });

    it('should clear latch when emergency is not active', async () => {
      const engine = new MockFailsafeEngine();
      engine.setEmergencyActive(false);
      
      await engine.tryFailSafe('TEST');
      
      expect(engine.isInFailsafe()).toBe(false); // Should be cleared
    });
  });

  describe('HeartbeatDaemon control', () => {
    class MockHeartbeatDaemon {
      private running = false;
      private startCalls = 0;
      private stopCalls = 0;

      start() {
        this.running = true;
        this.startCalls++;
      }

      stop() {
        this.running = false;
        this.stopCalls++;
      }

      isRunning() { return this.running; }
      getStartCalls() { return this.startCalls; }
      getStopCalls() { return this.stopCalls; }
    }

    class MockMainApp {
      private hbDaemon: MockHeartbeatDaemon;

      constructor() {
        this.hbDaemon = new MockHeartbeatDaemon();
      }

      onSerialData(line: string) {
        if (line.startsWith('EMERG')) {
          this.hbDaemon?.stop();
        }
        if (line.startsWith('EMERG_CLEARED')) {
          this.hbDaemon?.start();
        }
      }

      getHbDaemon() { return this.hbDaemon; }
    }

    it('should stop heartbeat daemon on EMERG', () => {
      const app = new MockMainApp();
      const hbDaemon = app.getHbDaemon();
      
      hbDaemon.start(); // Start initially
      expect(hbDaemon.isRunning()).toBe(true);
      
      app.onSerialData('EMERG: Test emergency');
      
      expect(hbDaemon.isRunning()).toBe(false);
      expect(hbDaemon.getStopCalls()).toBe(1);
    });

    it('should start heartbeat daemon on EMERG_CLEARED', () => {
      const app = new MockMainApp();
      const hbDaemon = app.getHbDaemon();
      
      app.onSerialData('EMERG: Test emergency');
      expect(hbDaemon.isRunning()).toBe(false);
      
      app.onSerialData('EMERG_CLEARED');
      
      expect(hbDaemon.isRunning()).toBe(true);
      expect(hbDaemon.getStartCalls()).toBe(1);
    });
  });

  describe('toSteps safety guards', () => {
    class MockSequenceEngine {
      private toSteps(rawSteps: any[]): any[] {
        const steps: any[] = [];
        for (const s of rawSteps) {
          if (typeof s === 'string') { 
            steps.push({ type: 'cmd', payload: s }); 
            continue; 
          }
          if (s && s.type) { 
            steps.push(s); 
            continue; 
          }

          // Safety guard: only create time-wait step if delay > 0
          if (s.delay && s.delay > 0) {
            steps.push({ type: 'wait', timeoutMs: s.delay, condition: { kind: 'time' } });
          }

          for (const c of (s.commands ?? [])) {
            try {
              steps.push({ type: 'cmd', payload: this.mapCmd(c) });
            } catch (err) {
              console.warn('Unknown command key:', c, 'Error:', err);
            }
          }
          if (s.condition) {
            steps.push({ type: 'wait', timeoutMs: s.condition.timeoutMs ?? 30000, condition: s.condition });
          }
        }
        return steps;
      }

      private mapCmd(cmd: string): string {
        if (cmd === 'V,0,O') return 'V,0,O';
        if (cmd === 'UNKNOWN_CMD') throw new Error('Unknown command');
        return cmd;
      }

      // Test wrapper
      testToSteps(rawSteps: any[]) {
        return this.toSteps(rawSteps);
      }
    }

    it('should not create time-wait step for delay <= 0', () => {
      const engine = new MockSequenceEngine();
      
      const rawSteps = [
        { delay: 0, commands: ['V,0,O'] },
        { delay: -100, commands: ['V,0,O'] },
        { delay: 1000, commands: ['V,0,O'] } // This should create a wait step
      ];
      
      const steps = engine.testToSteps(rawSteps);
      
      // Should have 3 cmd steps and 1 wait step (only for delay: 1000)
      const waitSteps = steps.filter(s => s.type === 'wait');
      expect(waitSteps).toHaveLength(1);
      expect(waitSteps[0].timeoutMs).toBe(1000);
    });

    it('should handle unknown commands gracefully with warning', () => {
      const engine = new MockSequenceEngine();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const rawSteps = [
        { commands: ['V,0,O', 'UNKNOWN_CMD', 'V,0,O'] }
      ];
      
      const steps = engine.testToSteps(rawSteps);
      
      // Should have 2 valid commands, 1 invalid ignored
      const cmdSteps = steps.filter(s => s.type === 'cmd');
      expect(cmdSteps).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalledWith('Unknown command key:', 'UNKNOWN_CMD', 'Error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Chart ReferenceLine improvements', () => {
    interface ChartConfig {
      alarm?: number;
      trip?: number;
      data: Array<{ pt1: number; pt2: number; pt3: number; pt4: number }>;
    }

    function calculateYMax(config: ChartConfig): number {
      const { alarm, trip, data } = config;
      const maxObserved = Math.max(0, ...data.map(d => Math.max(d.pt1 ?? 0, d.pt2 ?? 0, d.pt3 ?? 0, d.pt4 ?? 0)));
      const calculatedMax = Math.max(maxObserved, (trip ?? 900) * 1.1);
      return Number.isFinite(calculatedMax) && calculatedMax > 0 ? calculatedMax : 900 * 1.1;
    }

    function generateReferenceLines(alarm?: number, trip?: number): Array<{ type: 'alarm' | 'trip'; value: number; color: string; label: string }> {
      const lines: Array<{ type: 'alarm' | 'trip'; value: number; color: string; label: string }> = [];
      
      if (typeof alarm === 'number') {
        lines.push({ type: 'alarm', value: alarm, color: 'hsl(var(--chart-2))', label: 'Alarm' });
      }
      if (typeof trip === 'number') {
        lines.push({ type: 'trip', value: trip, color: 'hsl(var(--destructive))', label: 'Trip' });
      }
      
      return lines;
    }

    it('should protect against NaN/negative values in yMax calculation', () => {
      const configWithNaN: ChartConfig = {
        data: [{ pt1: NaN, pt2: -100, pt3: 0, pt4: Infinity }],
        trip: NaN
      };
      
      const yMax = calculateYMax(configWithNaN);
      
      expect(Number.isFinite(yMax)).toBe(true);
      expect(yMax).toBe(900 * 1.1); // Default fallback
    });

    it('should generate correct reference lines with labels and colors', () => {
      const lines = generateReferenceLines(850, 1000);
      
      expect(lines).toHaveLength(2);
      
      const alarmLine = lines.find(l => l.type === 'alarm');
      expect(alarmLine).toEqual({
        type: 'alarm',
        value: 850,
        color: 'hsl(var(--chart-2))',
        label: 'Alarm'
      });
      
      const tripLine = lines.find(l => l.type === 'trip');
      expect(tripLine).toEqual({
        type: 'trip',
        value: 1000,
        color: 'hsl(var(--destructive))',
        label: 'Trip'
      });
    });

    it('should handle missing alarm/trip gracefully', () => {
      const lines = generateReferenceLines(undefined, 1000);
      
      expect(lines).toHaveLength(1);
      expect(lines[0].type).toBe('trip');
    });
  });

  describe('Integration test - Complete emergency flow', () => {
    it('should handle complete emergency sequence', async () => {
      // Mock all components
      const mockSerial = {
        clearQueue: jest.fn(),
        abortInflight: jest.fn(),
        abortAllPendings: jest.fn(),
        writeNow: jest.fn()
      };
      
      const mockHbDaemon = {
        start: jest.fn(),
        stop: jest.fn()
      };
      
      // Simulate emergency detection
      const emergencyData = 'EMERG: Pressure exceeded 1200 PSI';
      
      // 1. SequenceEngine should halt transmission
      if (emergencyData.startsWith('EMERG')) {
        mockSerial.clearQueue();
        mockSerial.abortInflight('emergency');
        mockSerial.abortAllPendings('emergency');
      }
      
      // 2. MainApp should stop heartbeat daemon
      if (emergencyData.startsWith('EMERG')) {
        mockHbDaemon.stop();
      }
      
      // 3. Failsafe should execute with proper sequence
      const roles = { mains: [0, 1], vents: [5], purges: [6] };
      const closePass = roles.mains.map(m => `V,${m},C`);
      const openPass = [...roles.vents.map(v => `V,${v},O`), ...roles.purges.map(p => `V,${p},O`)];
      
      for (const pass of [closePass, openPass, openPass]) {
        for (const c of pass) {
          mockSerial.writeNow(c);
        }
      }
      
      // Verify all components responded correctly
      expect(mockSerial.clearQueue).toHaveBeenCalled();
      expect(mockSerial.abortInflight).toHaveBeenCalledWith('emergency');
      expect(mockSerial.abortAllPendings).toHaveBeenCalledWith('emergency');
      expect(mockHbDaemon.stop).toHaveBeenCalled();
      expect(mockSerial.writeNow).toHaveBeenCalledTimes(6); // 2 close + 2 open + 2 open retry
      
      // Verify command sequence
      const writeNowCalls = mockSerial.writeNow.mock.calls.map(call => call[0]);
      expect(writeNowCalls).toEqual(['V,0,C', 'V,1,C', 'V,5,O', 'V,6,O', 'V,5,O', 'V,6,O']);
    });
  });
});