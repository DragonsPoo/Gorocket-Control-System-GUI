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
      // HB는 실패해도 조용히 무시. 연결 안 되어 있으면 send가 reject됨.
      this.serial.send({ raw: 'HB' }).catch(() => {});
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // SAFETY: Send immediate heartbeat for faster MCU arming
  sendOnce() {
    this.serial.send({ raw: 'HB' }).catch(() => {});
  }
}
