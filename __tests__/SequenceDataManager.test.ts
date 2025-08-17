
import { SequenceDataManager } from '../main/SequenceDataManager';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock Ajv
const mockValidate = jest.fn();
const mockCompile = jest.fn(() => mockValidate);
const mockAjvInstance = {
  compile: mockCompile,
  errorsText: jest.fn(() => 'Mock validation error'),
};

jest.mock('ajv', () => jest.fn(() => mockAjvInstance));

const mockExistsSync = require('fs').existsSync as jest.MockedFunction<any>;
const mockReadFileSync = require('fs').readFileSync as jest.MockedFunction<any>;

describe('SequenceDataManager', () => {
  let sequenceDataManager: SequenceDataManager;
  const mockBasePath = '/mock/path';

  beforeEach(() => {
    sequenceDataManager = new SequenceDataManager(mockBasePath);
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true); // Default to files existing
    mockValidate.mockReturnValue(true); // Default to valid data
  });

  describe('loadAndValidate', () => {
    const validSequences = {
      'Test Sequence': [
        {
          message: 'Open valve 1',
          delay: 1000,
          commands: ['CMD,Ethanol Main Supply,Open']
        },
        {
          message: 'Close valve 1',
          delay: 500,
          commands: ['CMD,Ethanol Main Supply,Close']
        }
      ],
      'Emergency Shutdown': [
        {
          message: 'Emergency close all',
          delay: 0,
          commands: ['CMD,System Vent 1,Open', 'CMD,Ethanol Purge Line,Open', 'CMD,N2O Purge Line,Open']
        }
      ]
    };

    const validSchema = {
      type: 'object',
      properties: {
        'Emergency Shutdown': { type: 'array' }
      },
      required: ['Emergency Shutdown']
    };

    it('should successfully load valid sequences', () => {
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(validSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
      expect(sequenceDataManager.getSequences()).toEqual(validSequences);
    });

    it('should fail when sequences.json does not exist', () => {
      mockExistsSync.mockImplementation((filePath: any) => 
        !filePath.toString().includes('sequences.json')
      );

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('sequences.json not found');
    });

    it('should fail when schema file does not exist', () => {
      mockExistsSync.mockImplementation((filePath: any) => 
        !filePath.toString().includes('sequences.schema.json')
      );

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('sequences.schema.json not found');
    });

    it('should fail with invalid JSON schema', () => {
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(validSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));
      
      mockValidate.mockReturnValue(false);

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mock validation error');
    });

    it('should fail when Emergency Shutdown sequence is missing', () => {
      const invalidSequences = {
        'Test Sequence': [
          {
            message: 'Test',
            delay: 1000,
            commands: ['CMD,Ethanol Main Supply,Open']
          }
        ]
        // Missing Emergency Shutdown
      };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(invalidSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required sequence: "Emergency Shutdown"');
    });
  });

  describe('Forbidden combinations static validation', () => {
    const validSchema = {
      type: 'object',
      properties: {},
      required: ['Emergency Shutdown']
    };

    it('should reject sequences with forbidden valve combinations in same step', () => {
      const forbiddenSequences = {
        'Emergency Shutdown': [
          {
            message: 'Emergency',
            delay: 0,
            commands: ['CMD,System Vent 1,Open']
          }
        ],
        'Dangerous Sequence': [
          {
            message: 'Dangerous operation',
            delay: 1000,
            commands: [
              'CMD,Ethanol Main Supply,Open',
              'CMD,System Vent 1,Open' // Forbidden combination
            ]
          }
        ]
      };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(forbiddenSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Static forbidden combo');
      expect(result.errors).toContain('Ethanol Main Supply');
      expect(result.errors).toContain('System Vent 1');
    });

    it('should reject ethanol main + system vent combination', () => {
      const forbiddenSequences = {
        'Emergency Shutdown': [
          {
            message: 'Emergency',
            delay: 0,
            commands: ['CMD,System Vent 1,Open']
          }
        ],
        'Bad Sequence': [
          {
            message: 'Bad operation',
            delay: 1000,
            commands: [
              'CMD,Ethanol Main Supply,Open',
              'CMD,System Vent 1,Open' // Forbidden combination
            ]
          }
        ]
      };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(forbiddenSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Static forbidden combo');
      expect(result.errors).toContain('Ethanol Main Supply');
      expect(result.errors).toContain('System Vent 1');
    });

    it('should allow pressurant fill + system vent combination (for purge operations)', () => {
      const validPurgeSequences = {
        'Emergency Shutdown': [
          {
            message: 'Emergency',
            delay: 0,
            commands: ['CMD,System Vent 1,Open']
          }
        ],
        'Purge Operation': [
          {
            message: 'Purge operations are allowed',
            delay: 1000,
            commands: [
              'CMD,Main Pressurization,Open',
              'CMD,System Vent 1,Open' // Now allowed for purge operations
            ]
          }
        ]
      };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(validPurgeSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should allow valid sequences without forbidden combinations', () => {
      const validSequences = {
        'Emergency Shutdown': [
          {
            message: 'Emergency close all',
            delay: 0,
            commands: ['CMD,System Vent 1,Open', 'CMD,Ethanol Purge Line,Open', 'CMD,N2O Purge Line,Open']
          }
        ],
        'Safe Sequence': [
          {
            message: 'Open ethanol main',
            delay: 1000,
            commands: ['CMD,Ethanol Main Supply,Open']
          },
          {
            message: 'Close ethanol main',
            delay: 500,
            commands: ['CMD,Ethanol Main Supply,Close']
          }
        ]
      };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(validSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Dynamic dry run validation', () => {
    beforeEach(() => {
      const validSequences = {
        'Emergency Shutdown': [
          {
            message: 'Emergency',
            delay: 0,
            commands: ['CMD,System Vent 1,Open']
          }
        ],
        'Test Sequence': [
          {
            message: 'Step 1',
            delay: 1000,
            commands: ['CMD,Ethanol Main Supply,Open']
          },
          {
            message: 'Step 2',
            delay: 2000,
            commands: ['CMD,System Vent 1,Open'] // This will create a forbidden state
          }
        ]
      };

      const validSchema = { type: 'object', required: ['Emergency Shutdown'] };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(validSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      sequenceDataManager.loadAndValidate();
    });

    it('should detect forbidden combinations across timeline', () => {
      const result = sequenceDataManager.dryRunSequence('Test Sequence');

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('Dynamic forbidden combo');
      expect(result.errors[0]).toContain('Ethanol Main Supply');
      expect(result.errors[0]).toContain('System Vent 1');
      expect(result.errors[0]).toContain('both OPEN');
    });

    it('should pass for sequences without forbidden combinations', () => {
      const safeSequences = {
        'Emergency Shutdown': [
          {
            message: 'Emergency',
            delay: 0,
            commands: ['CMD,System Vent 1,Open']
          }
        ],
        'Safe Sequence': [
          {
            message: 'Open ethanol',
            delay: 1000,
            commands: ['CMD,Ethanol Main Supply,Open']
          },
          {
            message: 'Close ethanol before opening N2O',
            delay: 500,
            commands: ['CMD,Ethanol Main Supply,Close']
          },
          {
            message: 'Open N2O',
            delay: 1000,
            commands: ['CMD,N2O Main Supply,Open']
          }
        ]
      };

      const validSchema = { type: 'object', required: ['Emergency Shutdown'] };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(safeSequences))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const manager = new SequenceDataManager(mockBasePath);
      manager.loadAndValidate();

      const result = manager.dryRunSequence('Safe Sequence');

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-existent sequences', () => {
      const result = sequenceDataManager.dryRunSequence('Non-existent Sequence');

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('Sequence not found or empty');
    });

    it('should skip Emergency Shutdown in dryRunAll', () => {
      const result = sequenceDataManager.dryRunAll();

      // Should only validate 'Test Sequence', not 'Emergency Shutdown'
      expect(result.ok).toBe(false); // Because Test Sequence has forbidden combo
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Timing and state tracking', () => {
    it('should track valve states through sequence timeline', () => {
      const sequenceWithTiming = {
        'Emergency Shutdown': [
          {
            message: 'Emergency',
            delay: 0,
            commands: ['CMD,System Vent 1,Open']
          }
        ],
        'Timing Test': [
          {
            message: 'Open valve',
            delay: 1000,
            commands: ['CMD,Ethanol Main Supply,Open']
          },
          {
            message: 'Wait period',
            delay: 2000,
            commands: [] // No commands, just delay
          },
          {
            message: 'Open another valve - should conflict',
            delay: 500,
            commands: ['CMD,System Vent 1,Open']
          }
        ]
      };

      const validSchema = { type: 'object', required: ['Emergency Shutdown'] };

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(sequenceWithTiming))
        .mockReturnValueOnce(JSON.stringify(validSchema));

      const manager = new SequenceDataManager(mockBasePath);
      manager.loadAndValidate();

      const result = manager.dryRunSequence('Timing Test');

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('t≈3500ms'); // Should track cumulative time (1000 + 2000 + 500)
    });
  });

  describe('Error handling', () => {
    it('should handle file read errors gracefully', () => {
      mockReadFileSync.mockImplementation(() => { 
        throw new Error('File read error'); 
      });

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to read/validate sequences');
      expect(result.errors).toContain('File read error');
    });

    it('should handle malformed JSON', () => {
      mockReadFileSync.mockReturnValue('invalid json {');

      const result = sequenceDataManager.loadAndValidate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to read/validate sequences');
    });
  });
});
