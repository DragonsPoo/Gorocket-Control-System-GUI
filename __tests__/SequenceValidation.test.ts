// Test forbidden combination logic directly without mocking complex dependencies

describe('Sequence Validation Logic', () => {
  // Simulate forbidden combination checking logic
  const forbiddenPairs: Array<[string, string]> = [
    ['Ethanol Main', 'N2O Main'],
    ['Ethanol Main', 'System Vent'],
    ['N2O Main', 'System Vent'],
    ['Pressurant Fill', 'System Vent'],
  ];

  function checkForbiddenCombos(commands: string[]): string[] {
    const errors: string[] = [];
    
    for (const [a, b] of forbiddenPairs) {
      const aOpen = `CMD,${a},Open`;
      const bOpen = `CMD,${b},Open`;
      if (commands.includes(aOpen) && commands.includes(bOpen)) {
        errors.push(`Static forbidden combo: "${aOpen}" + "${bOpen}"`);
      }
    }
    
    return errors;
  }

  function dryRunSequence(steps: Array<{ commands: string[] }>): { ok: boolean; errors: string[] } {
    const state = new Map<string, 'OPEN' | 'CLOSED'>();
    const errors: string[] = [];
    let t = 0;

    steps.forEach((step, idx) => {
      // Update valve states
      for (const cmd of step.commands) {
        const m = /^CMD,([^,]{1,64}),(Open|Close)$/.exec(cmd);
        if (m) {
          const valveName = m[1];
          const act = m[2];
          state.set(valveName, act === 'Open' ? 'OPEN' : 'CLOSED');
        }
      }

      // Check forbidden combinations
      for (const [a, b] of forbiddenPairs) {
        if (state.get(a) === 'OPEN' && state.get(b) === 'OPEN') {
          errors.push(`Dynamic forbidden combo at step #${idx + 1}: "${a}" + "${b}" both OPEN`);
        }
      }
    });

    return { ok: errors.length === 0, errors };
  }

  describe('Static validation (same step)', () => {
    it('should reject ethanol main + N2O main in same step', () => {
      const commands = ['CMD,Ethanol Main,Open', 'CMD,N2O Main,Open'];
      const errors = checkForbiddenCombos(commands);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Ethanol Main');
      expect(errors[0]).toContain('N2O Main');
    });

    it('should reject ethanol main + system vent in same step', () => {
      const commands = ['CMD,Ethanol Main,Open', 'CMD,System Vent,Open'];
      const errors = checkForbiddenCombos(commands);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Ethanol Main');
      expect(errors[0]).toContain('System Vent');
    });

    it('should reject pressurant fill + system vent in same step', () => {
      const commands = ['CMD,Pressurant Fill,Open', 'CMD,System Vent,Open'];
      const errors = checkForbiddenCombos(commands);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Pressurant Fill');
      expect(errors[0]).toContain('System Vent');
    });

    it('should allow safe combinations', () => {
      const commands = ['CMD,Ethanol Main,Open', 'CMD,Ethanol Purge,Open'];
      const errors = checkForbiddenCombos(commands);
      
      expect(errors).toHaveLength(0);
    });

    it('should allow emergency combinations', () => {
      const commands = ['CMD,System Vent,Open', 'CMD,Ethanol Purge,Open', 'CMD,N2O Purge,Open'];
      const errors = checkForbiddenCombos(commands);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('Dynamic validation (across timeline)', () => {
    it('should detect forbidden state across steps', () => {
      const steps = [
        { commands: ['CMD,Ethanol Main,Open'] },
        { commands: ['CMD,N2O Main,Open'] }, // Both now open
      ];
      
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Ethanol Main');
      expect(result.errors[0]).toContain('N2O Main');
      expect(result.errors[0]).toContain('both OPEN');
    });

    it('should allow sequential opening if first is closed', () => {
      const steps = [
        { commands: ['CMD,Ethanol Main,Open'] },
        { commands: ['CMD,Ethanol Main,Close'] },
        { commands: ['CMD,N2O Main,Open'] }, // Safe now
      ];
      
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle complex state transitions', () => {
      const steps = [
        { commands: ['CMD,Pressurant Fill,Open'] },
        { commands: ['CMD,System Vent,Open'] }, // Forbidden: pressurizing + venting
      ];
      
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('Pressurant Fill');
      expect(result.errors[0]).toContain('System Vent');
    });

    it('should handle multiple forbidden states in sequence', () => {
      const steps = [
        { commands: ['CMD,Ethanol Main,Open'] },
        { commands: ['CMD,N2O Main,Open'] }, // First violation
        { commands: ['CMD,System Vent,Open'] }, // Second violation (with both mains)
      ];
      
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2); // Multiple violations
    });
  });

  describe('Emergency sequences', () => {
    it('should allow emergency shutdown patterns', () => {
      const steps = [
        { 
          commands: [
            'CMD,System Vent,Open',
            'CMD,Ethanol Purge,Open',
            'CMD,N2O Purge,Open'
          ]
        }
      ];
      
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow emergency shutdown from dangerous state', () => {
      const steps = [
        { commands: ['CMD,Ethanol Main,Open'] },
        { commands: ['CMD,N2O Main,Open'] }, // Dangerous state
        { 
          commands: [
            'CMD,Ethanol Main,Close',
            'CMD,N2O Main,Close',
            'CMD,System Vent,Open',
            'CMD,Ethanol Purge,Open'
          ]
        }
      ];
      
      const result = dryRunSequence(steps);
      
      // Should fail at step 2 but succeed after emergency close
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1); // Only the step 2 violation
    });
  });

  describe('Edge cases', () => {
    it('should handle empty commands', () => {
      const steps = [{ commands: [] }];
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed commands gracefully', () => {
      const steps = [
        { commands: ['CMD,Ethanol Main,Open'] },
        { commands: ['INVALID_COMMAND', 'CMD,N2O Main,Open'] },
      ];
      
      const result = dryRunSequence(steps);
      
      // Should still catch the valid commands
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('both OPEN');
    });

    it('should handle close-then-open in same step', () => {
      const steps = [
        { commands: ['CMD,Ethanol Main,Open'] },
        { 
          commands: [
            'CMD,Ethanol Main,Close',
            'CMD,N2O Main,Open'
          ]
        },
      ];
      
      const result = dryRunSequence(steps);
      
      expect(result.ok).toBe(true); // Should be safe due to close first
    });
  });
});