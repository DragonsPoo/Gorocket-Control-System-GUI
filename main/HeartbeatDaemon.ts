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
      // HB는 비차단 경로로 즉시 전송 (큐 대기 없음)
      this.serial.writeNow('HB');
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // SAFETY: Send immediate heartbeat for faster MCU arming
  sendOnce() {
    this.serial.writeNow('HB');
  }
}
