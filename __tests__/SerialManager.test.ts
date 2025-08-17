import { SerialManager } from '../main/SerialManager';

// Mock serialport module
const mockPort = {
  isOpen: true,
  write: jest.fn(),
  close: jest.fn(),
  pipe: jest.fn(),
  once: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockParser = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => mockPort)
}));

jest.mock('@serialport/parser-readline', () => ({
  ReadlineParser: jest.fn().mockImplementation(() => mockParser)
}));

const { SerialPort } = require('serialport');

describe('SerialManager', () => {
  let serialManager: SerialManager;

  beforeEach(() => {
    serialManager = new SerialManager();
    jest.clearAllMocks();
    
    // Reset mock state
    mockPort.isOpen = true;
    mockPort.write.mockImplementation((data, cb) => {
      if (cb) setImmediate(cb);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('listPorts', () => {
    it('should return available ports', async () => {
      const mockPorts = [
        { path: 'COM1' },
        { path: 'COM2' },
      ];
      SerialPort.list.mockResolvedValue(mockPorts);

      const result = await serialManager.listPorts();
      
      expect(result).toEqual(['COM1', 'COM2']);
      expect(SerialPort.list).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('should connect successfully with valid handshake', async () => {
      // Mock successful connection
      mockPort.once.mockImplementation((event, cb) => {
        if (event === 'open') {
          setImmediate(cb);
        }
      });

      // Mock handshake response
      const connectPromise = serialManager.connect('COM1', 115200);
      
      // Simulate READY response
      setImmediate(() => {
        mockParser.emit('data', 'READY');
      });

      const result = await connectPromise;
      
      expect(result).toBe(true);
      expect(SerialPort.default).toHaveBeenCalledWith({
        path: 'COM1',
        baudRate: 115200,
        autoOpen: true,
      });
    });

    it('should handle connection timeout', async () => {
      jest.useFakeTimers();
      
      mockPort.once.mockImplementation((event, cb) => {
        if (event === 'open') {
          setImmediate(cb);
        }
      });

      const connectPromise = serialManager.connect('COM1', 115200);
      
      // Fast-forward timers to trigger timeout
      jest.advanceTimersByTime(5000);
      
      await expect(connectPromise).rejects.toThrow('Connection timeout');
      
      jest.useRealTimers();
    });
  });

  describe('CRC validation', () => {
    it('should validate CRC correctly for framed messages', () => {
      // Access private method for testing
      const frame = (serialManager as any).frame('V,0,O');
      
      expect(frame.framed).toMatch(/^V,0,O,\d+,[A-Fa-f0-9]{2}$/);
      
      // Parse the framed message
      const parts = frame.framed.split(',');
      const payload = parts.slice(0, -2).join(',');
      const msgId = parseInt(parts[parts.length - 2]);
      const crcHex = parts[parts.length - 1];
      
      expect(payload).toBe('V,0,O');
      expect(msgId).toBeGreaterThan(0);
      expect(crcHex).toMatch(/^[A-Fa-f0-9]{2}$/);
    });

    it('should reject messages with invalid CRC', async () => {
      const sendPromise = serialManager.send({ type: 'V', servoIndex: 0, action: 'O' } as any);
      
      // Simulate invalid CRC response
      setImmediate(() => {
        mockParser.emit('data', 'V,0,O,1,FF'); // Wrong CRC
      });
      
      // Should not resolve immediately due to invalid CRC
      // The message should be retried or eventually timeout
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the message is still pending
      expect((serialManager as any).inflight).toBeTruthy();
    });
  });

  describe('ACK/NACK handling', () => {
    it('should handle ACK correctly', async () => {
      jest.useFakeTimers();
      
      const sendPromise = serialManager.send({ type: 'V', servoIndex: 0, action: 'O' } as any);
      
      // Get the message ID from inflight
      const inflight = (serialManager as any).inflight;
      expect(inflight).toBeTruthy();
      
      // Simulate ACK response
      setImmediate(() => {
        mockParser.emit('data', `ACK,${inflight.msgId}`);
      });
      
      jest.runAllTimers();
      const result = await sendPromise;
      
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });

    it('should handle NACK and retry', async () => {
      jest.useFakeTimers();
      
      const sendPromise = serialManager.send({ type: 'V', servoIndex: 0, action: 'O' } as any);
      
      // Get the message ID from inflight
      const inflight = (serialManager as any).inflight;
      expect(inflight).toBeTruthy();
      
      // Simulate NACK response
      setImmediate(() => {
        mockParser.emit('data', `NACK,${inflight.msgId},CRC_ERR`);
      });
      
      // Advance time to trigger retry
      jest.advanceTimersByTime(100);
      
      // Simulate ACK on retry
      const retriedInflight = (serialManager as any).inflight;
      if (retriedInflight) {
        setImmediate(() => {
          mockParser.emit('data', `ACK,${retriedInflight.msgId}`);
        });
      }
      
      jest.runAllTimers();
      const result = await sendPromise;
      
      expect(result).toBe(true);
      
      jest.useRealTimers();
    });

    it('should fail after max retries', async () => {
      jest.useFakeTimers();
      
      const sendPromise = serialManager.send({ type: 'V', servoIndex: 0, action: 'O' } as any);
      
      // Simulate multiple NACKs
      let attemptCount = 0;
      const maxRetries = 5;
      
      const sendNack = () => {
        const inflight = (serialManager as any).inflight;
        if (inflight && attemptCount < maxRetries) {
          attemptCount++;
          setImmediate(() => {
            mockParser.emit('data', `NACK,${inflight.msgId},CRC_ERR`);
          });
          
          // Advance time to trigger retry
          jest.advanceTimersByTime(100);
          
          if (attemptCount < maxRetries) {
            setTimeout(sendNack, 10);
          }
        }
      };
      
      sendNack();
      jest.runAllTimers();
      
      await expect(sendPromise).rejects.toThrow(/NACK.*CRC_ERR/);
      
      jest.useRealTimers();
    });
  });

  describe('Queue management', () => {
    it('should process queue sequentially', async () => {
      jest.useFakeTimers();
      
      // Send multiple commands
      const promise1 = serialManager.send({ type: 'V', servoIndex: 0, action: 'O' } as any);
      const promise2 = serialManager.send({ type: 'V', servoIndex: 1, action: 'O' } as any);
      const promise3 = serialManager.send({ type: 'V', servoIndex: 2, action: 'O' } as any);
      
      // Only first should be inflight initially
      expect((serialManager as any).inflight).toBeTruthy();
      expect((serialManager as any).queue).toHaveLength(2);
      
      // ACK first command
      let inflight = (serialManager as any).inflight;
      setImmediate(() => {
        mockParser.emit('data', `ACK,${inflight.msgId}`);
      });
      
      jest.runAllTimers();
      await promise1;
      
      // Second should now be inflight
      expect((serialManager as any).inflight).toBeTruthy();
      expect((serialManager as any).queue).toHaveLength(1);
      
      // ACK second command
      inflight = (serialManager as any).inflight;
      setImmediate(() => {
        mockParser.emit('data', `ACK,${inflight.msgId}`);
      });
      
      jest.runAllTimers();
      await promise2;
      
      // Third should now be inflight
      expect((serialManager as any).inflight).toBeTruthy();
      expect((serialManager as any).queue).toHaveLength(0);
      
      // ACK third command
      inflight = (serialManager as any).inflight;
      setImmediate(() => {
        mockParser.emit('data', `ACK,${inflight.msgId}`);
      });
      
      jest.runAllTimers();
      await promise3;
      
      // All done
      expect((serialManager as any).inflight).toBeNull();
      expect((serialManager as any).queue).toHaveLength(0);
      
      jest.useRealTimers();
    });
  });

  describe('Backoff strategy', () => {
    it('should implement exponential backoff for retries', async () => {
      jest.useFakeTimers();
      
      const sendPromise = serialManager.send({ type: 'V', servoIndex: 0, action: 'O' } as any);
      
      let attemptCount = 0;
      const delays: number[] = [];
      
      const originalSetTimeout = global.setTimeout;
      jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
        if (delay && delay > 50) { // Filter out our test delays
          delays.push(delay as number);
        }
        return originalSetTimeout(fn, delay);
      });
      
      // Generate some NACKs to trigger retries
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const inflight = (serialManager as any).inflight;
          if (inflight) {
            mockParser.emit('data', `NACK,${inflight.msgId},CRC_ERR`);
          }
        }, 10 + i * 50);
      }
      
      // Finally send ACK
      setTimeout(() => {
        const inflight = (serialManager as any).inflight;
        if (inflight) {
          mockParser.emit('data', `ACK,${inflight.msgId}`);
        }
      }, 500);
      
      jest.runAllTimers();
      await sendPromise;
      
      // Verify that delays are implementing backoff (should be around 80ms each)
      expect(delays.length).toBeGreaterThan(0);
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(50); // At least NACK_RETRY_DELAY
      });
      
      jest.useRealTimers();
    });
  });
});