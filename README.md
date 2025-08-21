# GoRocket Control System GUI — Ground Test Operations Manual

Version: 2.6.0 (Electron 37 / Next.js 15 / TypeScript 5)

This document is the definitive, end-to-end operations manual for the GoRocket Control System GUI used for ground-based liquid rocket engine testing. It teaches the underlying concepts, the end-to-end data flow, safety mechanisms, the on-screen workflow, and the maintenance tasks required to operate the system with confidence. With only this manual and the installed GUI, an operator new to the project should be able to set up, arm, operate, and safely shut down the test stand.

Important: This GUI connects over a wired USB serial link to an Arduino Mega 2560 running the paired firmware (included under `arduino_mega_code/`). The software is designed for safety-first ground testing. Physical E‑stop, pressure relief hardware, and trained personnel are always required.


## Table of Contents

1. Safety Principles and Responsibilities
2. System Overview and Architecture
3. Hardware and Wiring Checklist
4. Serial Protocol and Telemetry
5. Safety Mechanisms and Timing Characteristics
6. Software Installation and Launch (Windows)
7. User Interface Tour and Operational Workflow
8. Logging, File Artifacts, and Data Retention
9. Configuration: `config.json` (Valve Mapping, Limits, Feedback)
10. Sequences: Concept, Authoring, Validation (`sequences.json`)
11. How to Change Valve Mapping and Sequences Safely
12. Troubleshooting and Common Issues
13. Build, Package, and Tests (for Maintainers)
14. Reference Appendix


## 1) Safety Principles and Responsibilities

- Purpose: This GUI is a supervisory control and monitoring tool for ground testing. It enforces software-level safety measures (ARM gating, emergency fail-safe, pressure alarms), but cannot replace physical safety systems or procedures.
- You must have: Physical E‑stop, relief valves, clear safety perimeters, communication protocols, and trained personnel. Follow your Day‑of‑Test checklist and runbook.
- Risk acceptance: Only qualified operators may ARM and send control commands. Always double-check hardware before ARM. Never bypass safety latches by modifying code or configuration ad hoc.
- Primary emergency mechanism: Hardware E‑stop. The GUI also uses automatic and operator-triggered software fail-safe routines.


## 2) System Overview and Architecture

High-level components:

- Electron Main Process (`main.ts`):
  - Loads configuration and sequences, enforces safety policies (ARM gating), owns the SerialManager.
  - Hosts SequenceEngine (executes sequences), HeartbeatDaemon (periodic HB), LogManager (session logs), SequenceDataManager (JSON validation + dry run checks).
  - IPC bridge to the Renderer via a sandboxed preload.

- Renderer (Next.js UI under `src/`):
  - Displays sensors, valve states, charting, sequences UI, connection and ARM controls.
  - Talks to main via `window.electronAPI` (preload bridge) for serial commands, sequences, safety, and logging.

- Preload Bridge (`preload.ts`):
  - Exposes safe, typed functions into `window.electronAPI` (e.g., `listSerialPorts`, `connectSerial`, `sequenceStart`, `safetyTrigger`, `startLogging`).

- SerialManager (`main/SerialManager.ts`):
  - Manages the serial port, frames commands, tracks ACK/NACK with timeouts and retries, queues commands with priority handling, and reconnects on failure.

- SequenceEngine (`main/SequenceEngine.ts`):
  - Executes step-based sequences (cmd/wait), performs feedback waits and pressure waits with debounce, and triggers fail-safe routines on errors.

- HeartbeatDaemon (`main/HeartbeatDaemon.ts`):
  - Sends periodic “HB” pings to the MCU, including an immediate HB on connect for fast arming on the firmware side.

- LogManager (`main/LogManager.ts`):
  - Creates a timestamped session folder, snapshots config and sequences, writes CSV telemetry/valve states, marks state events, and fsyncs periodically.

- SequenceDataManager (`main/SequenceDataManager.ts`):
  - Validates `sequences.json` against `sequences.schema.json` with Ajv, and runs static and dry-run checks to block hazardous patterns.

- Firmware (Arduino Mega 2560):
  - Receives CRC-framed commands, actuates servos (valves), checks limit switches, measures pressure/flow/temperature, emits CRC-protected telemetry, enforces EMERG/TRIP rules, responds with ACK/NACK.

Data Flow (simplified):

Renderer UI → Preload (IPC) → Electron Main → SerialManager → Arduino Mega
Arduino Telemetry/Status → SerialManager → Electron Main → Renderer UI → Operator


## 3) Hardware and Wiring Checklist

- Host PC: Windows 10/11, USB port available, Node.js 20+ (for dev), Electron runtime packaged for ops.
- Arduino Mega 2560: Verified board and USB cable.
- Servo wiring: 7 servos mapped to indices 0–6; wiring matches `servoPins[]` in firmware.
- Limit switches: Paired OPEN/CLOSED inputs per valve; ensure normally-open/closed state matches firmware wiring and logic.
- Pressure sensors: 1–4 connected to A0–A3 (calibrated in firmware units psi).
- Flow sensors: 2x pulse sensors (D2 INT0, D3 INT1), debounce and EWMA implemented.
- Thermocouples: MAX6675 modules on SPI (pins documented in firmware).
- Safety: Physical E‑stop accessible and tested. Relief paths verified functional.
- Power: Stable supply for servos and sensors; avoid brownouts on actuation.


## 4) Serial Protocol and Telemetry

Command Framing (to MCU):

- Text lines, newline terminated `\n`.
- Framed format: `payload,msgId,crcHex`
  - `payload`: e.g., `V,4,O` (valve #4 open), `HB`, `HELLO`, `SAFE_CLEAR`
  - `msgId`: integer (assigned by sender)
  - `crcHex`: 2‑digit uppercase hex of CRC‑8 over the ASCII of `payload,msgId`
- ACK/NACK responses:
  - `ACK,<msgId>`
  - `NACK,<msgId>,<REASON>` (e.g., `NACK,42,BUSY`, `NACK,42,CRC_FAIL`)

Common Payloads:

- `HELLO` → MCU responds `READY` and ACK; used on connect as handshake.
- `HB` → Heartbeat; on receipt, MCU updates lastHeartbeat and ACKs.
- `SAFE_CLEAR` → Clears EMERG state on MCU and emits `EMERG_CLEARED`.
- `V,<idx>,O|C` → Open/Close servo valve by index.

Telemetry (from MCU):

- System lines (not CRC-framed): `READY`, `BOOT,*`, `PONG`, `EMERG`, `EMERG_CLEARED`, `ACK,*`, `NACK,*`.
- Sensor/valve lines must end with `,XX` (CRC‑8 hex). Examples:
  - `pt1:850.5,pt2:900.0,V0_LS_OPEN:1,tc1:25.5,A9`
  - Keys:
    - Pressures: `pt1..pt4` (psi)
    - Flow: `fm1_Lh` `fm2_Lh` mapped to `flow1`/`flow2` (L/h)
    - Thermocouples: `tc1` `tc2` (number or error string)
    - Limit switches: `V<idx>_LS_OPEN` / `V<idx>_LS_CLOSED` with 0/1

CRC Details:

- CRC‑8 polynomial 0x07, init 0x00, no reflect, xorout 0x00 (lookup-table optimized on both sides).
- The GUI discards telemetry with missing or mismatched CRC and logs a concise error showing both received and calculated values.


## 5) Safety Mechanisms and Timing Characteristics

ARM Gating:

- The system is DISARMED by default after start and after any serial disconnection or EMERG event.
- While DISARMED, control commands and sequences are blocked by the main process.
- Operators must explicitly ARM after verifying physical safety (see UI workflow below).

Emergency Handling:

- Automatic: The GUI monitors pressure limits and rate-of-change in real time and, on exceedance, emits a safety event to the main process. The main initiates a software fail-safe: closes mains and opens vents/purges using both a sequence path and direct fallback raw commands.
- Firmware EMERG: The MCU can trigger `EMERG` autonomously (e.g., heartbeat timeout or trip). When EMERG occurs, the GUI immediately halts heartbeat and clears queues. After `EMERG_CLEARED`, heartbeat resumes but the system remains DISARMED until the operator ARMs again.
- Manual (Operator): From the Sequences panel you can run the “Emergency Shutdown” sequence while ARMED. Physical E‑stop remains the primary emergency action at all times.

Heartbeat:

- HeartbeatDaemon: sends `HB` every ~250 ms when connected; sends one immediate `HB` on connect for fast MCU arming.
- SequenceEngine HB (during sequence) is disabled in our configuration to avoid redundancy; the daemon is the canonical source.

Timing Defaults (software):

- SerialManager ACK timeout: 1500 ms, 5 retries (NACK retry delay 80 ms).
- SequenceEngine ACK timeout: 1000 ms (per command).
- Feedback timeout: 5000 ms default (limit switch polling at 50 ms).
- Pressure wait debounce: 3 consecutive samples must satisfy threshold.
- Reconnect: starts at 300 ms, exponential backoff up to 5 s.
- Handshake timeouts: open wait up to 5 s; HELLO/READY up to 3 s.


## 6) Software Installation and Launch (Windows)

Operator install (packaged):

1. Install the packaged NSIS installer or unzip a provided release.
2. Ensure Arduino Mega driver is available (Windows should auto-install). Confirm the COM port appears in Device Manager.
3. Launch the “GoRocket Control System GUI”.
4. Place your `config.json` and `sequences.json` next to the app’s `resources/` folder if updates are needed (see Section 11). The app loads these from the resources path when packaged.

Developer install (source):

1. Requirements: Node.js 20+, npm 10+, Python 3.x (if needed by native modules), build tools.
2. `npm install`
3. Development: `npm run dev` (spawns Next dev server and Electron after it is ready on port 9002)
4. Build app binaries: `npm run build && npm run package`
5. Troubleshooting native modules: If serialport binary mismatch occurs, run `npm run rebuild`.


## 7) User Interface Tour and Operational Workflow

Panels at a glance:

- Header: Connection, port selection, Refresh, Connect/Disconnect, logging controls, pressure alarm/trip indicators, DISARMED/ARMED state, and “Clear Emergency”.
- Sensor Panel: Live sensor values from telemetry (pt1–pt4, flows, temps).
- Valve Control & Status: Seven valve tiles showing name, state, and limit switch status, with open/close buttons.
- Control Sequences: Start a sequence (requires ARMED), including “Emergency Shutdown”. Cancel button stops the current sequence.
- Chart Panel: Time-series chart of pressures and other sensors with alarm/trip lines.
- Terminal Panel: Recent sequence log lines and messages.

Operational steps:

1. Power-on hardware: Ensure all hardware and safety systems are ready.
2. Launch GUI. Initially, the system is DISARMED.
3. Select the correct COM port and click Connect. The GUI performs a HELLO/READY handshake and starts heartbeat (250 ms).
4. Verify telemetry updates (pressures, flows, temperatures, valve limit switches). If not, check wiring and CRC errors.
5. ARM the system:
   - Confirm the physical test stand is in a safe configuration.
   - Click “ARM System” and confirm in the dialog. The UI shows ARMED.
6. Operate:
   - Manual valves: Use Open/Close on each valve tile. States update on limit switches; if stuck, the UI flags “STUCK”.
   - Sequences: Start a predefined sequence (e.g., “Pre‑Operation Safe Init”, “Hot‑Fire Sequence”). The UI logs progress per step.
7. Emergency response:
   - Automatic: GUI triggers fail-safe on pressure limit/rate exceedance; MCU can enter EMERG spontaneously based on firmware trip logic.
   - Manual: While ARMED, start “Emergency Shutdown” from the Sequences panel. Always be prepared to hit the physical E‑stop.
8. Clear MCU emergency: If the MCU is in `EMERG`, press and hold “Clear Emergency” for ~3 seconds, then confirm. The GUI sends `SAFE_CLEAR` and awaits `EMERG_CLEARED`.
9. DISARM transition: Any EMERG or disconnection causes DISARM. Re‑ARM is required before issuing control commands again.
10. Logging: Use “Start Logging” / “Stop Logging”. Logs are written under Documents; see Section 8.

Zoom and Accessibility:

- Ctrl + Mouse Wheel: Zoom chart/UI in/out; Ctrl + ‘=’/‘-’/‘0’ also works. A reset option is available.


## 8) Logging, File Artifacts, and Data Retention

When logging is started, the GUI creates a session folder:

- Location: `Documents/rocket-logs/session-YYYYMMDD-HHMMSS/`
- Files:
  - `data.csv`: Timestamped CSV lines of sensor fields and summarized valve state (e.g., `V0:OPEN`).
  - `config.json`, `sequences.json`: Snapshots for traceability (or annotated placeholder if missing).
  - `session-meta.json`: App version, platform, Electron/Node versions, SHA‑256 of config/sequences, and safety thresholds in use.

Log format:

- Regular telemetry lines: `ISO8601,<pt1>,<pt2>,<pt3>,<pt4>,<flow1>,<flow2>,<tc1>,<tc2>,<valves>`
- State events (`EMERG`, `FAILSAFE`, `READY`): Prefixed with `#` for post-analysis.
- ACK/NACK lines: Filtered out of CSV for clarity.
- Flush behavior: The logger fsyncs the file descriptor approximately every 2 seconds, and on app shutdown or emergency transitions.


## 9) Configuration: `config.json`

Location:

- Development: project root (`config.json`).
- Packaged: loaded from the application `resources/` directory.

Schema (fields):

- `serial.baudRate` (number): e.g., 115200.
- `maxChartDataPoints` (number): Number of points to retain in the UI chart.
- `pressureLimitPsi` (number): Base limit for UI use.
- `pressureLimitAlarmPsi` (number, optional): UI alarm line.
- `pressureLimitTripPsi` (number, optional): UI trip line.
- `pressureRateLimitPsiPerSec` (number, optional): Rate-of-change limit.
- `valveFeedbackTimeout` (ms): UI stuck detection timeout.
- `initialValves` (array): Name and initial states for 7 valves (IDs 1–7).
- `valveMappings` (record): Maps human names to servo indices (0–6). Example:

```
{
  "valveMappings": {
    "Ethanol Purge Line":   { "servoIndex": 0 },
    "Main Pressurization":  { "servoIndex": 1 },
    "Ethanol Fill Line":    { "servoIndex": 2 },
    "N2O Main Supply":      { "servoIndex": 3 },
    "Ethanol Main Supply":  { "servoIndex": 4 },
    "System Vent 1":        { "servoIndex": 5 },
    "System Vent 2":        { "servoIndex": 6 }
  }
}
```

Validation:

- The GUI validates pressure limits for basic sanity (e.g., alarm < trip). Warnings appear in console if fields are missing or suspicious.


## 10) Sequences: Concept, Authoring, Validation (`sequences.json`)

Concept:

- A sequence is an ordered list of steps. Each step has a human message, a `delay` (ms) before performing commands, an optional `condition` wait, and a list of `commands` to issue.
- Two command forms are supported:
  - By index: `"V,<idx>,O|C"` (e.g., `"V,4,O"`)
  - By name: `"CMD,<ValveName>,Open|Close"` (mapped via `config.json` valveMappings)

Conditions:

- Pressure conditions on `pt1..pt4` with operators `gte`/`lte`, min/max thresholds, and `timeoutMs`.
- Example: Wait for `pt1 >= 580 psi` with a 120 s timeout:

```
{ "sensor": "pt1", "min": 580, "op": "gte", "timeoutMs": 120000 }
```

Validation and Safety Nets:

- The app validates `sequences.json` against `sequences.schema.json` using Ajv.
- Static prohibitions and dry-run checks block hazardous combinations (e.g., opening a main supply and a vent simultaneously in the same step). A valid `"Emergency Shutdown"` sequence is mandatory.
- On any validation failure at startup, the app displays an error and exits (fail-fast).

Dry Run:

- The app simulates each non-emergency sequence to detect logical conflicts (open-open combos). Failures abort startup.

Example snippets (excerpt):

```
"Emergency Shutdown": [
  {
    "message": "Immediate safe state",
    "delay": 0,
    "commands": [
      "CMD,Ethanol Main Supply,Close",
      "CMD,N2O Main Supply,Close",
      "CMD,Main Pressurization,Close",
      "CMD,Ethanol Fill Line,Close",
      "CMD,System Vent 1,Open",
      "CMD,System Vent 2,Open",
      "CMD,Ethanol Purge Line,Open"
    ]
  }
]
```


## 11) How to Change Valve Mapping and Sequences Safely

Valve Mapping (`config.json`):

- Edit `valveMappings` to reflect wiring changes (servo index 0–6). Ensure `initialValves` names match the mapping keys.
- After editing, restart the app. In a packaged app, update `resources/config.json` and relaunch.

Sequences (`sequences.json`):

- Edit steps using `CMD,<ValveName>,Open|Close` or `V,<idx>,O|C`.
- Keep hazardous combinations out of the same step. Use separate steps with delays if needed (e.g., purge then vent).
- Validate locally without launching the GUI:
  - `npm run validate:seq`
  - The script prints `AJV_OK true` or detailed errors.
- Restart the app to load updated sequences. In a packaged app, replace `resources/sequences.json` (and `resources/sequences.schema.json` if the schema also changed).

Recommended workflow:

1. Update `config.json` mapping first.
2. Update `sequences.json` commands (prefer `CMD,<ValveName>,...` for readability and mapping safety).
3. Run `npm run validate:seq`.
4. Launch the app; fix any startup validation errors.
5. Run HIL testing before any hot-fire operation.


## 12) Troubleshooting and Common Issues

- No COM ports / Connect fails:
  - Check Device Manager and drivers. Try a different USB port/cable. The GUI times out the open after ~5 s and shows an error.

- Handshake not READY:
  - The GUI sends `HELLO` and expects `READY` or `ACK` within ~3 s. If not, verify firmware is flashed and running, and power is stable.

- CRC mismatch errors in logs:
  - The GUI discards bad lines and prints a detailed integrity error. Ensure the firmware emits `...,<CRC>` with CRC‑8 poly 0x07 over the ASCII up to the final comma. Avoid serial line noise, verify ground/shielding.

- NACK BUSY / MCU Busy toasts:
  - The MCU rejects a command while a servo is in motion. Wait until the move completes. The GUI avoids disruptive dialogs for BUSY.

- EMERG storm / repeated EMERG events:
  - The system halts queues and latches a fail-safe state. Investigate root causes (pressure spikes, heartbeat issues). Clear via long-press “Clear Emergency” when safe, then re‑ARM.

- Sequences panel disabled (DISARMED):
  - ARM the system first (safety requirement). Automatic fail-safe still runs on pressure exceedance even when DISARMED.

- Logs missing or cannot create:
  - The GUI notifies via toast. Check Documents permissions and disk space.


## 13) Build, Package, and Tests (for Maintainers)

Scripts:

- `npm run dev` → Next dev server (Turbopack) + Electron (waits for `http://localhost:9002`).
- `npm run build:electron` → Compile main/preload TS to `dist/` and copy `config.json`.
- `npm run build:web` → Next static export to `out/`.
- `npm run build` → Electron + Web build.
- `npm run package` → Electron Builder (AppImage/NSIS/DMG) with `extraResources` including `config.json` / `sequences.json` / `sequences.schema.json`.
- `npm run typecheck` / `npm run lint`
- `npm test` → Jest tests (CRC parsing, fail-safe latching, acceptance-like paths).

Notes:

- Serialport native module is bundled; `asarUnpack` covers it. If local dev shows ABI mismatch, run `npm run rebuild`.
- CSP: In development, the app may allow `unsafe-eval` for HMR. If HMR websockets fail, extend `connect-src` to include `ws:` in dev builds only.


## 14) Reference Appendix

SequenceEngine semantics:

- Steps can be `cmd` or `wait`.
- `cmd` may include optional feedback: wait for limit switch (open/closed) with timeouts and polling intervals.
- `wait` condition for pressure uses debounced evaluation (3 consecutive matches by default) to avoid flicker and noise.

Fail-safe Passes (software):

- The engine closes mains, opens vents and purges in multiple passes, writing raw lines immediately when necessary, and also sending framed commands with short ACK timeouts to accelerate recovery.
- Valve roles (mains/vents/purges) are derived from your mapping at startup.

Telemetry Parsing (GUI):

- The GUI ignores and does not CRC‑check system messages (READY/EMERG/ACK/NACK).
- Mixed packets are accepted (e.g., sensor values plus limit switches) as long as the CRC is valid.

Log Structure:

- `#`-prefixed lines in `data.csv` mark state transitions (`EMERG`, `FAILSAFE`, `READY`).
- ACK/NACK lines are intentionally filtered to keep logs concise and analysis-friendly.

Runbooks and Checklists:

- See `RUNBOOK.md`, `DAY-OF-TEST-CHECKLIST.md`, and `HIL-Preflight-Checklist-Results.md` in the repository for recommended procedures and preflight results. Always adapt these to your specific test article and safety policies.


---

This manual reflects the behavior of the current codebase. If your hardware topology or risk posture differs, update `config.json` and `sequences.json` accordingly, validate them (`npm run validate:seq`), rehearse with HIL/low‑energy tests, and only then proceed to hot‑fire operations. Safety first.


## 15) IPC & Event Reference

Renderer → Main (ipcRenderer.invoke unless noted):

- `serial-list` → `Promise<string[]>`
  - Returns available serial port paths (e.g., `COM3`, `/dev/ttyUSB0`).
- `serial-connect` `{ path: string, baud: number }` → `Promise<boolean>`
  - Connects to the port, performs HELLO/READY handshake, starts heartbeat.
- `serial-disconnect` → `Promise<boolean>`
  - Gracefully closes the port and stops logging.
- `serial-send` `SerialCommand | { raw: string } | string` → `Promise<boolean>`
  - Sends a control/RAW command. If DISARMED and control command, rejects. BUSY errors emit `serial-busy` instead of dialog.
- `sequence-start` `(name: string)` → `Promise<boolean>`
  - Starts a named sequence. Requires ARMED.
- `sequence-cancel` → `Promise<boolean>`
  - Cancels the current sequence if any.
- `safety-trigger` `(snapshot?: { reason?: string })` → `Promise<boolean>`
  - Triggers software fail-safe (closes mains, opens vents/purges) and emits sequence error.
- `safety:pressureExceeded` (ipcRenderer.send) `(snapshot: PressureSnapshot)`
  - Notifies main that UI pressure safety exceeded; main executes fail-safe path with fallbacks.
- `config-get` → `Promise<AppConfig>`
- `get-sequences` → `Promise<{ sequences: SequenceConfig; result: ValidationResult }>`
- `safety-clear` → `Promise<boolean>`
  - Sends `SAFE_CLEAR` to MCU to clear EMERG; expect `EMERG_CLEARED` system line.
- `system-arm` → `Promise<boolean>`
  - Sets ARMED (enables control commands). Requires operator confirmation in UI.
- `system-arm-status` → `Promise<boolean>`
  - Returns `true` when ARMED.
- `zoom-in` / `zoom-out` / `zoom-reset` (ipcRenderer.send) → `void`
- `start-logging` / `stop-logging` (ipcRenderer.send) → `void`

Main → Renderer (ipcMain emitted events):

- `serial-status` `(SerialStatus)`
  - `state: 'connected' | 'disconnected' | 'reconnecting'`, `path?`.
- `serial-data` `(string)`
  - Raw telemetry/system lines. Renderer validates CRC for telemetry.
- `serial-error` `(string)`
- `serial-busy` `({ command: any; error: string })`
  - Non-disruptive BUSY notification for toasts.
- `sequence-progress` `({ name, stepIndex, step, note? })`
- `sequence-error` `({ name, stepIndex, step?, error })`
- `sequence-complete` `({ name })`
- `log-creation-failed` `(string | undefined)`

Preload API (window.electronAPI):

- Methods mirror the invocations above and provide subscription helpers: `onSerialStatus`, `onSerialData`, `onSerialError`, `onSerialBusy`, `onSequenceProgress`, `onSequenceError`, `onSequenceComplete`, `onLogCreationFailed`.


## 16) Code Path Walkthroughs

Connect & Handshake:

1. Renderer calls `listSerialPorts()` and `connectSerial(path, baud)`.
2. Main `SerialManager.connect()`:
   - Opens port and pipes `ReadlineParser` (newline-delimited).
   - Subscribes to `close`, `error`, and `data`.
   - Performs `sendHelloHandshake()` → frames `HELLO` → expects `READY` or ACK within ~3 s.
   - Emits `serial-status: connected`, starts `HeartbeatDaemon` (250 ms) and sends an immediate `HB`.
   - Starts logging on successful connect.

Command Send (manual valve or sequence step):

1. Renderer invokes `sendToSerial(cmd)`.
2. Main validates ARM for control commands; rejects if DISARMED.
3. `SerialManager.send()`:
   - Builds payload from `SerialCommand` or `raw`/string.
   - Frames `payload,msgId,crc` if needed.
   - Queues as in-flight, writes line, starts ACK timeout (default 1500 ms, 5 retries).
   - On `ACK,<id>`: resolves and processes next; on `NACK,<id>,BUSY`: requeues or emits `serial-busy` to UI.

Telemetry Flow:

1. MCU emits lines. System lines (`READY`, `EMERG`, `ACK`, `NACK`, …) are passed through.
2. Sensor lines end with `,XX` CRC. The renderer parses via `parseSensorData()`:
   - Verifies CRC‑8(0x07); on mismatch, discards and logs an integrity error.
   - Extracts `pt1..pt4`, `fm*_Lh` → `flow*`, `tc*` (number or error strings), and valve limit switch states.
3. UI updates sensor state, chart, and per‑valve LS indicators. Pressure safety monitor may emit `safety:pressureExceeded` to main.

Emergency Paths:

- Firmware‑driven: MCU sends `EMERG` → Main stops heartbeat, clears queues, aborts in‑flight/pending; UI locks controls; DISARM is enforced. On `EMERG_CLEARED`, heartbeat resumes; operator must re‑ARM.
- UI‑driven: Renderer sends `safety-trigger` or `safety:pressureExceeded` → Main runs `SequenceEngine.tryFailSafe()` and also issues mapped raw valve OPEN/CLOSE fallbacks (vents/purges open; mains close). Emits `sequence-error` explaining reason.

Sequence Execution:

1. Renderer `sequenceStart(name)` → Main checks ARMED → `SequenceEngine.start(name)`.
2. Engine `toSteps()` normalizes steps: interleaves `cmd` and `wait` from JSON (`CMD,<ValveName>,Open|Close` → `V,<idx>,O/C` via mapping).
3. For `cmd`:
   - Send framed payload with ACK timeout (default 1000 ms).
   - Optional feedback: poll LS states until target state or timeout.
4. For `wait` (pressure): evaluate debounced condition (N consecutive matches) until `timeoutMs`.
5. Emits `sequence-progress` per step; `sequence-complete` at end. On error, emits `sequence-error` and optionally triggers fail-safe.


## 17) State Machines

SerialManager (queue/ACK):

- States: `idle` → `writing` → `awaiting-ack` → `ack` (success) → `idle`.
- Timeouts: On ACK timeout or `NACK`, requeue with delay (80 ms) up to retries. On write error/port close, emit error and schedule reconnect (exponential backoff to 5 s).
- Priority: EMERG/FAILSAFE/HB/SAFE_CLEAR treated as priority in queue management.

SequenceEngine:

- Running flags: `running`, `cancelled`, `currentIndex` tracking.
- Steps: `cmd` (send + optional LS feedback), `wait` (time or pressure with debounce).
- Fail-safe: `inFailsafe` latch prevents reentry within 400 ms; remains latched while `emergencyActive`.
- Heartbeat: Engine HB disabled by default (Daemon provides HB). Cleanup stops HB and clears pendings.

ARM Gating:

- `requiresArm` (true on startup, disconnect, EMERG). Control commands and sequences blocked when true.
- Renderer shows DISARMED banner; operator must call `systemArm()` to enable control.
