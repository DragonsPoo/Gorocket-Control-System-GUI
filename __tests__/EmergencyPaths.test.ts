// Test emergency paths and renderer independence

describe('Emergency Paths', () => {
  describe('Pressure limit detection', () => {
    interface SensorData {
      pt1: number;
      pt2: number; 
      pt3: number;
      pt4: number;
      timestamp: number;
    }

    function exceedsPressureLimit(data: SensorData, limit: number): boolean {
      return (
        data.pt1 > limit ||
        data.pt2 > limit ||
        data.pt3 > limit ||
        data.pt4 > limit
      );
    }

    function calculatePressureRate(current: SensorData, previous: SensorData): number {
      const timeDelta = (current.timestamp - previous.timestamp) / 1000; // Convert to seconds
      if (timeDelta <= 0) return 0;

      const maxCurrentPressure = Math.max(current.pt1, current.pt2, current.pt3, current.pt4);
      const maxPreviousPressure = Math.max(previous.pt1, previous.pt2, previous.pt3, previous.pt4);
      
      return (maxCurrentPressure - maxPreviousPressure) / timeDelta;
    }

    function shouldTriggerEmergency(
      current: SensorData, 
      previous: SensorData | null,
      alarmLimit: number,
      tripLimit: number,
      rateLimit: number | null
    ): { trigger: boolean; reason: string } {
      // Trip limit check (highest priority)
      if (exceedsPressureLimit(current, tripLimit)) {
        return { trigger: true, reason: 'PRESSURE_TRIP' };
      }

      // Alarm limit check
      if (exceedsPressureLimit(current, alarmLimit)) {
        return { trigger: true, reason: 'PRESSURE_ALARM' };
      }

      // Rate of change check
      if (rateLimit && previous) {
        const rate = calculatePressureRate(current, previous);
        if (rate > rateLimit) {
          return { trigger: true, reason: 'PRESSURE_RATE_EXCEEDED' };
        }
      }

      return { trigger: false, reason: '' };
    }

    it('should trigger emergency on pressure trip limit', () => {
      const sensorData: SensorData = {
        pt1: 1200, pt2: 800, pt3: 700, pt4: 600,
        timestamp: Date.now()
      };

      const result = shouldTriggerEmergency(sensorData, null, 850, 1000, null);

      expect(result.trigger).toBe(true);
      expect(result.reason).toBe('PRESSURE_TRIP');
    });

    it('should trigger emergency on pressure alarm limit', () => {
      const sensorData: SensorData = {
        pt1: 900, pt2: 800, pt3: 700, pt4: 600,
        timestamp: Date.now()
      };

      const result = shouldTriggerEmergency(sensorData, null, 850, 1000, null);

      expect(result.trigger).toBe(true);
      expect(result.reason).toBe('PRESSURE_ALARM');
    });

    it('should trigger emergency on excessive pressure rate', () => {
      const baseTime = Date.now();
      const previous: SensorData = {
        pt1: 100, pt2: 150, pt3: 120, pt4: 110,
        timestamp: baseTime
      };
      const current: SensorData = {
        pt1: 700, pt2: 150, pt3: 120, pt4: 110, // 600 PSI increase in 1 second
        timestamp: baseTime + 1000
      };

      const result = shouldTriggerEmergency(current, previous, 850, 1000, 500); // 500 PSI/s limit

      expect(result.trigger).toBe(true);
      expect(result.reason).toBe('PRESSURE_RATE_EXCEEDED');
    });

    it('should not trigger on normal conditions', () => {
      const sensorData: SensorData = {
        pt1: 400, pt2: 350, pt3: 300, pt4: 250,
        timestamp: Date.now()
      };

      const result = shouldTriggerEmergency(sensorData, null, 850, 1000, null);

      expect(result.trigger).toBe(false);
    });

    it('should prioritize trip over alarm', () => {
      const sensorData: SensorData = {
        pt1: 1200, pt2: 800, pt3: 700, pt4: 600, // Exceeds both alarm and trip
        timestamp: Date.now()
      };

      const result = shouldTriggerEmergency(sensorData, null, 850, 1000, null);

      expect(result.trigger).toBe(true);
      expect(result.reason).toBe('PRESSURE_TRIP'); // Should be trip, not alarm
    });
  });

  describe('Emergency valve selection', () => {
    interface ValveMapping {
      [name: string]: { servoIndex: number };
    }

    function getEmergencyValveCommands(valveMappings: ValveMapping): string[] {
      const commands: string[] = [];
      
      // System vent
      if (valveMappings['System Vent']) {
        commands.push(`V,${valveMappings['System Vent'].servoIndex},O`);
      }
      
      // Purge valves
      if (valveMappings['Ethanol Purge']) {
        commands.push(`V,${valveMappings['Ethanol Purge'].servoIndex},O`);
      }
      if (valveMappings['N2O Purge']) {
        commands.push(`V,${valveMappings['N2O Purge'].servoIndex},O`);
      }

      // Explicitly close main valves
      if (valveMappings['Ethanol Main']) {
        commands.push(`V,${valveMappings['Ethanol Main'].servoIndex},C`);
      }
      if (valveMappings['N2O Main']) {
        commands.push(`V,${valveMappings['N2O Main'].servoIndex},C`);
      }

      return commands;
    }

    it('should generate correct emergency commands', () => {
      const valveMappings: ValveMapping = {
        'Ethanol Main': { servoIndex: 0 },
        'N2O Main': { servoIndex: 1 },
        'Ethanol Purge': { servoIndex: 2 },
        'N2O Purge': { servoIndex: 3 },
        'Pressurant Fill': { servoIndex: 4 },
        'System Vent': { servoIndex: 5 },
        'Igniter Fuel': { servoIndex: 6 }
      };

      const commands = getEmergencyValveCommands(valveMappings);

      expect(commands).toContain('V,5,O'); // System Vent open
      expect(commands).toContain('V,2,O'); // Ethanol Purge open
      expect(commands).toContain('V,3,O'); // N2O Purge open
      expect(commands).toContain('V,0,C'); // Ethanol Main closed
      expect(commands).toContain('V,1,C'); // N2O Main closed
      
      // Should NOT contain igniter fuel opening
      expect(commands).not.toContain('V,6,O');
    });

    it('should handle missing valve mappings gracefully', () => {
      const partialMappings: ValveMapping = {
        'System Vent': { servoIndex: 5 },
        'Ethanol Purge': { servoIndex: 2 },
        // Missing N2O Purge and main valves
      };

      const commands = getEmergencyValveCommands(partialMappings);

      expect(commands).toContain('V,5,O'); // System Vent
      expect(commands).toContain('V,2,O'); // Ethanol Purge
      expect(commands).not.toContain('V,3,O'); // N2O Purge missing
      expect(commands).not.toContain('V,0,C'); // Ethanol Main missing
    });
  });

  describe('Heartbeat monitoring', () => {
    function simulateHeartbeatMonitor(
      intervalMs: number,
      timeoutMs: number = 3000
    ): {
      start: () => void;
      stop: () => void;
      simulateTimeout: () => boolean;
      lastHeartbeat: number;
    } {
      let lastHeartbeat = Date.now();
      let intervalId: NodeJS.Timeout | null = null;

      return {
        start() {
          intervalId = setInterval(() => {
            lastHeartbeat = Date.now();
          }, intervalMs);
        },
        
        stop() {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        },

        simulateTimeout() {
          const now = Date.now();
          return (now - lastHeartbeat) > timeoutMs;
        },

        get lastHeartbeat() {
          return lastHeartbeat;
        }
      };
    }

    it('should detect heartbeat timeout', () => {
      const monitor = simulateHeartbeatMonitor(250, 1000); // 250ms interval, 1s timeout
      
      // Simulate passage of time without heartbeat
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 1500); // 1.5s later

      expect(monitor.simulateTimeout()).toBe(true);

      Date.now = originalNow; // Restore
    });

    it('should not timeout with regular heartbeats', () => {
      const monitor = simulateHeartbeatMonitor(250, 1000);
      monitor.start();

      // Immediate check should not timeout
      expect(monitor.simulateTimeout()).toBe(false);
      
      monitor.stop();
    });
  });

  describe('Renderer independence', () => {
    interface EmergencyState {
      triggered: boolean;
      reason: string;
      timestamp: number;
      commands: string[];
    }

    function emergencyStateMachine(): {
      state: EmergencyState;
      triggerEmergency: (reason: string, commands: string[]) => void;
      reset: () => void;
      isActive: () => boolean;
    } {
      let state: EmergencyState = {
        triggered: false,
        reason: '',
        timestamp: 0,
        commands: []
      };

      return {
        get state() { return { ...state }; },

        triggerEmergency(reason: string, commands: string[]) {
          if (!state.triggered) { // Prevent re-entry
            state = {
              triggered: true,
              reason,
              timestamp: Date.now(),
              commands: [...commands]
            };
          }
        },

        reset() {
          state = {
            triggered: false,
            reason: '',
            timestamp: 0,
            commands: []
          };
        },

        isActive() {
          return state.triggered;
        }
      };
    }

    it('should maintain emergency state without renderer', () => {
      const emergency = emergencyStateMachine();

      emergency.triggerEmergency('PRESSURE_TRIP', ['V,5,O', 'V,2,O']);

      expect(emergency.isActive()).toBe(true);
      expect(emergency.state.reason).toBe('PRESSURE_TRIP');
      expect(emergency.state.commands).toEqual(['V,5,O', 'V,2,O']);
    });

    it('should prevent emergency re-entry', () => {
      const emergency = emergencyStateMachine();

      emergency.triggerEmergency('PRESSURE_TRIP', ['V,5,O']);
      const firstTriggerTime = emergency.state.timestamp;

      // Try to trigger again
      emergency.triggerEmergency('HEARTBEAT_TIMEOUT', ['V,2,O']);

      expect(emergency.state.reason).toBe('PRESSURE_TRIP'); // Should remain first
      expect(emergency.state.timestamp).toBe(firstTriggerTime);
      expect(emergency.state.commands).toEqual(['V,5,O']); // Should remain first
    });

    it('should allow reset and re-trigger', () => {
      const emergency = emergencyStateMachine();

      emergency.triggerEmergency('PRESSURE_TRIP', ['V,5,O']);
      expect(emergency.isActive()).toBe(true);

      emergency.reset();
      expect(emergency.isActive()).toBe(false);

      emergency.triggerEmergency('HEARTBEAT_TIMEOUT', ['V,2,O']);
      expect(emergency.isActive()).toBe(true);
      expect(emergency.state.reason).toBe('HEARTBEAT_TIMEOUT');
    });
  });

  describe('Multi-path emergency triggers', () => {
    interface EmergencyTriggers {
      pressureMonitor: boolean;
      heartbeatMonitor: boolean;
      userTrigger: boolean;
      mcuEmergency: boolean;
    }

    function shouldEnterEmergency(triggers: EmergencyTriggers): boolean {
      return Object.values(triggers).some(trigger => trigger);
    }

    it('should trigger on any emergency condition', () => {
      expect(shouldEnterEmergency({
        pressureMonitor: true,
        heartbeatMonitor: false,
        userTrigger: false,
        mcuEmergency: false
      })).toBe(true);

      expect(shouldEnterEmergency({
        pressureMonitor: false,
        heartbeatMonitor: true,
        userTrigger: false,
        mcuEmergency: false
      })).toBe(true);

      expect(shouldEnterEmergency({
        pressureMonitor: false,
        heartbeatMonitor: false,
        userTrigger: true,
        mcuEmergency: false
      })).toBe(true);

      expect(shouldEnterEmergency({
        pressureMonitor: false,
        heartbeatMonitor: false,
        userTrigger: false,
        mcuEmergency: true
      })).toBe(true);
    });

    it('should not trigger when all conditions are normal', () => {
      expect(shouldEnterEmergency({
        pressureMonitor: false,
        heartbeatMonitor: false,
        userTrigger: false,
        mcuEmergency: false
      })).toBe(false);
    });
  });
});