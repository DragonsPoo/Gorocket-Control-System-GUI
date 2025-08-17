# Configuration Documentation

This document explains the key configuration parameters in `config.json` and the related firmware settings.

## Pressure Thresholds

To enhance safety, the system uses a two-tier pressure limit system: **Alarm** and **Trip**.

### 1. `pressureLimitAlarm` (in `config.json`)

- **Role**: **Alarm (경보)**
- **Level**: GUI / Main Process
- **Default Value**: `850` (psi)
- **Description**: This is the first line of defense. The renderer process constantly monitors sensor data. If the pressure exceeds this value, the renderer immediately sends a `safety:pressureExceeded` message to the main process.
- **Action**: The main process receives the signal and triggers a software-level **Failsafe** sequence (defined in `SequenceEngine.ts`), which typically involves closing all main valves and opening vent/purge valves. It also sends redundant low-level commands as a backup.
- **UI Display**: This value is displayed in the main header bar, labeled as **ALARM**.

### 2. `pressureLimitTrip` (in `config.json` and `arduino_mega_code.ino`)

- **Role**: **Trip (차단)**
- **Level**: MCU (Arduino Firmware)
- **Default Value**: `1000` (psi)
- **Description**: This is the second and final line of defense, designed to function even if the main computer or the UI freezes. The Arduino firmware independently monitors pressure sensors.
- **Action**: If the pressure exceeds this value (`PRESSURE_TRIP_PSIx100`), the MCU immediately triggers a hardware-level **Emergency** sequence. This action is hardcoded on the MCU and will execute regardless of the main computer's state. It forces all main valves closed and vent/purge valves open.
- **UI Display**: This value is displayed in the main header bar, labeled as **TRIP**.

### Hysteresis

The `ALARM` level should always be set lower than the `TRIP` level to ensure a chance for a controlled software shutdown before the unrecoverable hardware trip occurs. A recommended margin is 15-20%.

- **ALARM**: 850 psi
- **TRIP**: 1000 psi

These values have been agreed upon by the operations team to provide a safe operating margin.
