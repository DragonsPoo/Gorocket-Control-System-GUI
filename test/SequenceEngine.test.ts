import { SequenceEngine } from '../main/SequenceEngine';
import { SerialManager } from '../main/SerialManager';
import { SequenceDataManager } from '../main/SequenceDataManager';
import { ConfigManager } from '../main/ConfigManager';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../main/SerialManager');
jest.mock('../main/SequenceDataManager');
jest.mock('../main/ConfigManager');

// A mock for the getWindow function
const mockGetWindow = jest.fn();

describe('SequenceEngine', () => {
  let serialManager: jest.Mocked<SerialManager>;
  let sequenceDataManager: jest.Mocked<SequenceDataManager>;
  let configManager: jest.Mocked<ConfigManager>;
  let engine: SequenceEngine;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Provide mock implementations
    serialManager = new (SerialManager as jest.Mock<SerialManager>)() as jest.Mocked<SerialManager>;
    // SerialManager is an EventEmitter, so we need to mock its 'on' method
    serialManager.on = jest.fn();

    sequenceDataManager = new (SequenceDataManager as jest.Mock<SequenceDataManager>)() as jest.Mocked<SequenceDataManager>;
    configManager = new (ConfigManager as jest.Mock<ConfigManager>)() as jest.Mocked<ConfigManager>;

    const options = {
      valveRoles: { mains: [0, 1, 2], vent: 3, purge: 4 },
      defaultAckTimeoutMs: 100,
    };

    engine = new SequenceEngine({
      serialManager,
      sequenceManager: sequenceDataManager,
      configManager,
      getWindow: mockGetWindow,
      options,
    });

    // Mock the private sendWithAck method to prevent actual sending and to spy on it
    // We cast to `any` to access the private method for testing purposes
    (engine as any).sendWithAck = jest.fn().mockResolvedValue(undefined);
  });

  describe('tryFailSafe', () => {
    it('should send commands to close main valves and open vent/purge valves', async () => {
      await engine.tryFailSafe('TEST_FAILSAFE');

      const sendWithAckMock = (engine as any).sendWithAck;

      // Check that main valves are closed
      expect(sendWithAckMock).toHaveBeenCalledWith('V,0,C', 700);
      expect(sendWithAckMock).toHaveBeenCalledWith('V,1,C', 700);
      expect(sendWithAckMock).toHaveBeenCalledWith('V,2,C', 700);

      // Check that vent and purge valves are opened
      expect(sendWithAckMock).toHaveBeenCalledWith('V,3,O', 700);
      expect(sendWithAckMock).toHaveBeenCalledWith('V,4,O', 700);

      // Verify the total number of calls
      expect(sendWithAckMock).toHaveBeenCalledTimes(5);
    });

    it('should emit a progress event with type "progress" on successful execution', async () => {
      const eventSpy = jest.fn();
      engine.on('progress', eventSpy);

      await engine.tryFailSafe('TEST_FAILSAFE_PROGRESS');

      expect(eventSpy).toHaveBeenCalledTimes(1);

      const emittedEvent = eventSpy.mock.calls[0][0];
      expect(emittedEvent).toMatchObject({
        name: 'failsafe',
        stepIndex: -1,
        step: { type: 'cmd', payload: 'FAILSAFE' },
        note: 'TEST_FAILSAFE_PROGRESS',
      });
    });

    it('should not throw an error if a send command fails', async () => {
      // Mock one of the send calls to reject
      (engine as any).sendWithAck.mockImplementation(async (cmd: string) => {
        if (cmd === 'V,1,C') {
          throw new Error('Fake serial error');
        }
        return Promise.resolve();
      });

      // The function should not throw, it should catch the error and continue
      await expect(engine.tryFailSafe('TEST_FAILSAFE_ERROR')).resolves.not.toThrow();

      const sendWithAckMock = (engine as any).sendWithAck;

      // Check that it still attempted to send all commands
      expect(sendWithAckMock).toHaveBeenCalledWith('V,0,C', 700);
      expect(sendWithAckMock).toHaveBeenCalledWith('V,1,C', 700); // The one that failed
      expect(sendWithAckMock).toHaveBeenCalledWith('V,2,C', 700);
      expect(sendWithAckMock).toHaveBeenCalledWith('V,3,O', 700);
      expect(sendWithAckMock).toHaveBeenCalledWith('V,4,O', 700);
      expect(sendWithAckMock).toHaveBeenCalledTimes(5);
    });
  });
});
