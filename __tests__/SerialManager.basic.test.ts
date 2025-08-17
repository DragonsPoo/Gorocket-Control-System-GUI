import { SerialManager } from '../main/SerialManager';
import { parseSensorData } from '@shared/utils/sensorParser';

// Mock serialport
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn(),
  }
}));

const { SerialPort } = require('serialport');

describe('SerialManager Basic Tests', () => {
  let serialManager: SerialManager;

  beforeEach(() => {
    serialManager = new SerialManager();
    jest.clearAllMocks();
  });

  describe('listPorts', () => {
    it('should return available ports', async () => {
      const mockPorts = [
        { path: 'COM1' },
        { path: 'COM2' },
        { path: '/dev/ttyUSB0' },
      ];
      SerialPort.list.mockResolvedValue(mockPorts);

      const result = await serialManager.listPorts();
      
      expect(result).toEqual(['COM1', 'COM2', '/dev/ttyUSB0']);
      expect(SerialPort.list).toHaveBeenCalled();
    });

    it('should handle empty port list', async () => {
      SerialPort.list.mockResolvedValue([]);

      const result = await serialManager.listPorts();
      
      expect(result).toEqual([]);
    });

    it('should handle port listing error', async () => {
      SerialPort.list.mockRejectedValue(new Error('Port listing failed'));

      await expect(serialManager.listPorts()).rejects.toThrow('Port listing failed');
    });
  });

  describe('CRC validation through sensorParser', () => {
    it('should validate correct CRC in sensor data', () => {
      // Test with known good data
      const result = parseSensorData('pt1:100,pt2:200,F4');
      
      expect(result.errors).toHaveLength(0);
      expect(result.sensor.pt1).toBe(100);
      expect(result.sensor.pt2).toBe(200);
    });

    it('should reject data with invalid CRC', () => {
      // Test with wrong CRC
      const result = parseSensorData('pt1:100,pt2:200,FF');
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('CRC mismatch');
      expect(result.sensor).toEqual({}); // Should be empty due to CRC failure
    });

    it('should reject data without CRC', () => {
      const result = parseSensorData('pt1:100,pt2:200');
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No CRC found');
      expect(result.sensor).toEqual({});
    });
  });

  describe('Sensor data parsing', () => {
    it('should parse valve limit switch data correctly', () => {
      const result = parseSensorData('V0_LS_OPEN:1,V0_LS_CLOSED:0,V1_LS_OPEN:0,V1_LS_CLOSED:1,FD');
      
      expect(result.errors).toHaveLength(0);
      expect(result.valves[1]).toEqual({ lsOpen: true, lsClosed: false });
      expect(result.valves[2]).toEqual({ lsOpen: false, lsClosed: true });
    });

    it('should parse mixed sensor and valve data', () => {
      const result = parseSensorData('pt1:850.5,pt2:900.0,V0_LS_OPEN:1,tc1:25.5,A9');
      
      expect(result.errors).toHaveLength(0);
      expect(result.sensor.pt1).toBe(850.5);
      expect(result.sensor.pt2).toBe(900.0);
      expect(result.sensor.tc1).toBe(25.5);
      expect(result.valves[1]).toEqual({ lsOpen: true });
    });

    it('should handle malformed sensor data', () => {
      const result = parseSensorData('pt1:invalid,pt2:200,A0');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid numeric value');
    });
  });

  describe('System message handling', () => {
    it('should skip CRC validation for system messages', () => {
      const systemMessages = [
        'READY',
        'BOOT,startup_complete',
        'EMERG_CLEARED',
        'VACK,valve_command_received',
        'VERR,valve_error',
        'PONG,heartbeat_response'
      ];

      systemMessages.forEach(msg => {
        const result = parseSensorData(msg);
        
        expect(result.errors).toHaveLength(0);
        expect(result.sensor).toEqual({});
        expect(result.valves).toEqual({});
      });
    });
  });

  describe('Pressure limit detection', () => {
    it('should detect pressure limit exceedance', () => {
      const { exceedsPressureLimit } = require('@shared/utils/sensorParser');
      
      const normalData = {
        pt1: 100, pt2: 200, pt3: 150, pt4: 300,
        flow1: 10, flow2: 15, tc1: 25, tc2: 30, timestamp: Date.now()
      };
      
      const highPressureData = {
        pt1: 1200, pt2: 200, pt3: 150, pt4: 300,
        flow1: 10, flow2: 15, tc1: 25, tc2: 30, timestamp: Date.now()
      };
      
      expect(exceedsPressureLimit(normalData, 1000)).toBe(false);
      expect(exceedsPressureLimit(highPressureData, 1000)).toBe(true);
    });
  });

  describe('Error resilience', () => {
    it('should handle empty sensor data gracefully', () => {
      const result = parseSensorData(',00'); // Empty data with proper CRC
      
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle corrupted data gracefully', () => {
      const result = parseSensorData('pt1:100:::invalid,pt2,72'); // Using calculated CRC for this malformed data
      
      expect(result.errors.length).toBeGreaterThan(0);
      // Note: pt1:100 still gets parsed as it's valid, even though other parts are malformed
      expect(result.sensor.pt1).toBe(100);
    });

    it('should continue processing valid parts despite some errors', () => {
      // This test verifies that one bad data point doesn't prevent parsing of good ones
      const result = parseSensorData('pt1:100,invalid_field:bad_value,pt2:200,BA');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.sensor.pt1).toBe(100);
      expect(result.sensor.pt2).toBe(200);
    });
  });
});