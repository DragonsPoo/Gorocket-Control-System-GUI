import type { SerialManager } from './SerialManager';

export class HeartbeatDaemon {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(private serial: SerialManager, intervalMs = 200) {
    this.intervalMs = intervalMs;
  }

  start(intervalMs?: number) {
    if (typeof intervalMs === 'number' && intervalMs > 0) {
      this.intervalMs = intervalMs;
    }
    this.stop();
    this.timer = setInterval(() => {
      // HB는 CRC 프레이밍 후 비차단 전송
      try {
        this.serial.send({ raw: 'HB' }).catch(() => {});
      } catch (e) {
        // 연결이 끊어진 경우 조용히 무시
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // SAFETY: Send immediate heartbeat for faster MCU arming
  sendOnce() {
    try {
      this.serial.send({ raw: 'HB' }).catch(() => {});
    } catch (e) {
      // 연결이 끊어진 경우 조용히 무시
    }
  }
}
