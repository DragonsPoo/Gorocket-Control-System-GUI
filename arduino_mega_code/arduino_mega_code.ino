// =================================================================
// Gorocket-Control-System-GUI (MEGA) - Integer/Fast ISR Optimized
// - Flow/Pressure/Print 경로 부동소수 제거(정수 고정소수점)
// - Flow ISR: micros() 제거 → Timer3(2 MHz) 기반 글리치 필터
// - (옵션) INT0/INT1 직접 ISR로 attachInterrupt 오버헤드 제거
// - PACKED_SERIAL: Serial.write 사용
// =================================================================
#include <SPI.h>
#include <Servo.h>
#include <avr/io.h>
#include <avr/interrupt.h>
#include "max6675.h"

// =========================== 옵션 ===========================
#ifndef SERIAL_BAUD
#define SERIAL_BAUD 115200
#endif

#define FAST_LIMIT_IO     1   // 포트 직접 읽기
#define PACKED_SERIAL     1   // 1: 버퍼 조립 후 1회 전송
#define FAST_FLOW_ISR     1   // 1: INT0/1 직접 ISR 사용(attachInterrupt 제거)
#define FLOW_TIMER3_TICK  1   // 1: Timer3 2MHz 프리런 타임베이스 사용(글리치 필터용)

// =========================== 서보 ===========================
#define NUM_SERVOS 7
const uint8_t initialOpenAngles[NUM_SERVOS]   = {7,25,12,13,27,39,45};
const uint8_t initialClosedAngles[NUM_SERVOS] = {103,121,105,117,129,135,135};
const uint8_t servoPins[NUM_SERVOS]           = {13,12,11,10,9,8,7};
Servo servos[NUM_SERVOS];

enum ServoState : uint8_t { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED, STALL_RELIEF };
ServoState servoStates[NUM_SERVOS];
uint8_t targetAngles[NUM_SERVOS];
unsigned long lastMoveTime[NUM_SERVOS];
// -1: opening(각도 감소), +1: closing(각도 증가), 0: 없음
int8_t servoDir[NUM_SERVOS] = {0};

#define SERVO_SETTLE_TIME   500UL
#define INCHING_INTERVAL      50UL
#define STALL_RELIEF_ANGLE      3
#define STALL_RELIEF_TIME   200UL

// =========================== 압력 ===========================
#define NUM_PRESSURE_SENSORS 4
#define MAX_PRESSURE_BAR 100.0f
#define BAR_TO_PSI       14.50377f
const uint8_t pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};
// 정수 스케일: psi*100 = adc * PSI_PER_ADC_X1000 / 10
static constexpr uint32_t PSI_PER_ADC_X1000 =
  (uint32_t)((MAX_PRESSURE_BAR * BAR_TO_PSI * 1000.0) / 1023.0 + 0.5);

// =========================== MAX6675 ===========================
#define TC_SO_PIN  50
#define TC_SCK_PIN 52
#define TC1_CS_PIN 49
#define TC2_CS_PIN 48
MAX6675 thermocouple1(TC_SCK_PIN, TC1_CS_PIN, TC_SO_PIN);
MAX6675 thermocouple2(TC_SCK_PIN, TC2_CS_PIN, TC_SO_PIN);

// =========================== 리미트 스위치 ===========================
const uint8_t limitSwitchPins[NUM_SERVOS][2] = {
  {22,23},{24,25},{26,27},{28,29},{30,31},{32,33},{34,35}
};
uint8_t currentLimitSwitchStates[NUM_SERVOS][2] = {0};

// =========================== 유량(분압 입력) ===========================
#define NUM_FLOW_SENSORS 2
const uint8_t flowSensorPins[NUM_FLOW_SENSORS] = {2, 3}; // D2(INT0), D3(INT1)

// 보정 상수(K)
#define K_PULSE_PER_L_FLOW1 1484.11f
#define K_PULSE_PER_L_FLOW2 1593.79f

// 정수 스케일(유량):
// m3/h를 1e-4 스케일로 유지(M_1e4). EWMA는 Q15 스케일(alpha 0..32767).
// inst_M_1e4 = counts * A[i] / dtMs, A[i] = round(3600*1e4 / K)
static constexpr uint32_t FLOW_A_1e4[NUM_FLOW_SENSORS] = {
  (uint32_t)((3600.0 * 10000.0) / K_PULSE_PER_L_FLOW1 + 0.5),
  (uint32_t)((3600.0 * 10000.0) / K_PULSE_PER_L_FLOW2 + 0.5)
};

// ISR 공유 변수
volatile unsigned long pulseCounts[NUM_FLOW_SENSORS] = {0,0};
#define MIN_PULSE_US 100UL

#if FLOW_TIMER3_TICK
// Timer3 2MHz(0.5us) → 틱 변환
#define TIMER3_TICK_PER_US 2UL
#define MIN_PULSE_T3_TICKS (MIN_PULSE_US * TIMER3_TICK_PER_US)
volatile uint16_t lastPulseTicks[NUM_FLOW_SENSORS] = {0,0};
#endif

// 계산값/타이밍
// flowRates: m3/h의 1e-4 스케일(정수)
int32_t flowRates_m3h_1e4[NUM_FLOW_SENSORS] = {0, 0};
// 온도는 m°C로 저장(정수)
int32_t tempCelsius_mC_1 = 0;
int32_t tempCelsius_mC_2 = 0;

#define SENSOR_READ_INTERVAL 100UL
#define TEMP_READ_INTERVAL   250UL
unsigned long lastSensorReadTime = 0;
unsigned long lastTempReadTime   = 0;
unsigned long lastFlowCalcMs     = 0;
#define FLOW_EWMA_TAU_MS 300UL

// =========================== 시리얼 파서(라인 버퍼) ===========================
static char   cmdBuf[96];
static size_t cmdLen = 0;
static unsigned long lastByteMs = 0;
#define LINE_IDLE_COMMIT_MS 200UL

// =========================== 출력 버퍼(옵션) ===========================
#if PACKED_SERIAL
static constexpr size_t OUTBUF_SZ = 512;
static char outBuf[OUTBUF_SZ];

// 10^n 테이블
static constexpr uint32_t POW10[7] = {1UL,10UL,100UL,1000UL,10000UL,100000UL,1000000UL};

static inline void bufPutChar(size_t &pos, char c) { if (pos < OUTBUF_SZ-1) outBuf[pos++] = c; }
static inline void bufPutStr(size_t &pos, const char* s) { while (*s && pos < OUTBUF_SZ-1) outBuf[pos++] = *s++; }
static inline void bufPutUInt(size_t &pos, uint32_t v) { char tmp[11]; ultoa(v, tmp, 10); bufPutStr(pos, tmp); }
static inline void bufPutInt(size_t &pos, int32_t v) { char tmp[12]; ltoa(v, tmp, 10); bufPutStr(pos, tmp); }

// scaled(정수)/10^decimals 출력
static inline void bufPutFixed(size_t &pos, int32_t scaled, uint8_t decimals) {
  if (scaled < 0) { bufPutChar(pos, '-'); scaled = -scaled; }
  uint32_t den = POW10[decimals];
  uint32_t ip = (uint32_t)scaled / den;
  uint32_t fp = (uint32_t)scaled % den;
  bufPutUInt(pos, ip);
  if (decimals == 0) return;
  bufPutChar(pos, '.');
  for (int8_t d = decimals-1; d >= 0; --d) {
    uint32_t div = POW10[d];
    uint8_t digit = (fp / div) % 10;
    bufPutChar(pos, char('0' + digit));
  }
}
static inline void bufEndlineAndSend(size_t &pos) {
  outBuf[pos++] = '\n'; // append LF
  Serial.write((const uint8_t*)outBuf, pos);
  pos = 0;
}
#endif

// 프로토타입
static void processCommandLine(char* line);
static void readSerialCommands();
static void updateTemperatureReadings();
static void updateLimitSwitchStates();
static void manageAllServoMovements(const unsigned long now);
static void readAndSendAllSensorData(const unsigned long now);

// =========================== 유틸 ===========================
static inline uint16_t alphaQ15_from_dt(uint16_t dtMs) {
  uint32_t denom = (uint32_t)FLOW_EWMA_TAU_MS + (uint32_t)dtMs;
  if (denom == 0) return 0;
  uint32_t a = ((uint32_t)dtMs << 15) / denom; // 0..32767
  if (a > 32767U) a = 32767U;
  return (uint16_t)a;
}

// =========================== ISR ===========================
#if FAST_FLOW_ISR
// INT0: D2, INT1: D3
static inline void handleFlowPulse(uint8_t idx) {
#if FLOW_TIMER3_TICK
  uint16_t nowT = TCNT3;
  uint16_t dt = (uint16_t)(nowT - lastPulseTicks[idx]); // 자동 overflow 보정
  if (dt >= MIN_PULSE_T3_TICKS) {
    pulseCounts[idx]++;
    lastPulseTicks[idx] = nowT;
  }
#else
  // Timer 기반 사용 안할 때(폴백): micros() 사용
  unsigned long now = micros();
  static volatile unsigned long lastUs[NUM_FLOW_SENSORS] = {0,0};
  if ((unsigned long)(now - lastUs[idx]) >= MIN_PULSE_US) {
    pulseCounts[idx]++;
    lastUs[idx] = now;
  }
#endif
}
ISR(INT0_vect) { handleFlowPulse(0); }
ISR(INT1_vect) { handleFlowPulse(1); }
#else
void countPulse1() { handleFlowPulse(0); }
void countPulse2() { handleFlowPulse(1); }
#endif

// =================================================================
void setup() {
  Serial.begin(SERIAL_BAUD);
  while (Serial.available()) { Serial.read(); }
  delay(50);
  Serial.println(F("BOOT"));

  delay(500); // MAX6675 안정화 대기

  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach();
    servoStates[i] = IDLE;
    targetAngles[i] = 90;
    lastMoveTime[i] = 0;
    servoDir[i] = 0;
  }

  pinMode(flowSensorPins[0], INPUT);
  pinMode(flowSensorPins[1], INPUT);

#if FLOW_TIMER3_TICK
  // Timer3: 프리런, 2MHz(0.5us)
  TCCR3A = 0;
  TCCR3B = 0;
  TCNT3  = 0;
  TCCR3B = _BV(CS31); // prescaler 8 -> 2 MHz
#endif

#if FAST_FLOW_ISR
  // 외부 인터럽트 직접 설정: Rising edge
  EICRA = (1 << ISC01) | (1 << ISC00)   // INT0 rising
        | (1 << ISC11) | (1 << ISC10);  // INT1 rising
  EIFR  = (1 << INTF0) | (1 << INTF1);  // clear pending
  EIMSK = (1 << INT0) | (1 << INT1);    // enable INT0/1
#else
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[0]), countPulse1, RISING);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[1]), countPulse2, RISING);
#endif

  lastFlowCalcMs = millis();
  Serial.println(F("READY"));
}

void loop() {
  const unsigned long now = millis();

  readSerialCommands();
  updateLimitSwitchStates();
  manageAllServoMovements(now);

  if ((unsigned long)(now - lastTempReadTime) >= TEMP_READ_INTERVAL) {
    lastTempReadTime = now;
    updateTemperatureReadings();
  }

  if ((unsigned long)(now - lastSensorReadTime) >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = now;
    readAndSendAllSensorData(now);
  }
}

// ========================= 시리얼 처리 =========================
static inline void uppercaseInPlace(char* s) {
  for (; *s; ++s) {
    if (*s >= 'a' && *s <= 'z') *s = char(*s - ('a' - 'A'));
  }
}

static void readSerialCommands() {
  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    lastByteMs = millis();

    if (ch == '\r') {
      continue;
    } else if (ch == '\n') {
      cmdBuf[cmdLen] = '\0';
      if (cmdLen > 0) processCommandLine(cmdBuf);
      cmdLen = 0;
    } else {
      if (cmdLen < sizeof(cmdBuf) - 1) {
        cmdBuf[cmdLen++] = ch;
      } else {
        cmdLen = 0; // overflow → drop line
      }
    }
  }

  if (cmdLen > 0 && (millis() - lastByteMs) > LINE_IDLE_COMMIT_MS) {
    cmdBuf[cmdLen] = '\0';
    processCommandLine(cmdBuf);
    cmdLen = 0;
  }
}

static void processCommandLine(char* line) {
  while (*line == ' ' || *line == '\t') ++line;
  char* end = line + strlen(line);
  while (end > line && (end[-1] == ' ' || end[-1] == '\t')) --end;
  *end = '\0';
  if (*line == '\0') return;

  uppercaseInPlace(line);

  if (!strcmp(line, "HELLO") || !strcmp(line, "H")) {
    Serial.println(F("READY"));
    return;
  }

  if (line[0] == 'V' && line[1] == ',') {
    char* p = line + 2;
    char* comma = strchr(p, ',');
    if (!comma) { Serial.println(F("VERR")); return; }
    *comma = '\0';
    int servoIndex = atoi(p);
    char stateCmd = (comma[1] != '\0') ? comma[1] : 0;

    if (servoIndex >= 0 && servoIndex < NUM_SERVOS && (stateCmd == 'O' || stateCmd == 'C')) {
      if (servoStates[servoIndex] == IDLE) {
        servos[servoIndex].attach(servoPins[servoIndex], 500, 2500);
        targetAngles[servoIndex] = (stateCmd == 'O') ? initialOpenAngles[servoIndex] : initialClosedAngles[servoIndex];
        servos[servoIndex].write(targetAngles[servoIndex]);
        servoStates[servoIndex] = MOVING;
        servoDir[servoIndex] = (stateCmd == 'O') ? -1 : +1; // 명시적 방향 저장
        lastMoveTime[servoIndex] = millis();
        Serial.print(F("VACK,")); Serial.print(servoIndex); Serial.print(',');
        Serial.println((stateCmd == 'O') ? F("O") : F("C"));
      } else {
        Serial.println(F("VERR"));
      }
    } else {
      Serial.println(F("VERR"));
    }
    return;
  }

  if (!strcmp(line, "PING")) { Serial.println(F("PONG")); return; }

  Serial.println(F("ERR_CMD"));
}

// ========================= 서보 상태 머신 =========================
static inline void enterStallRelief(uint8_t i, int reliefAngle, unsigned long now) {
  reliefAngle = constrain(reliefAngle, 0, 180);
  servos[i].write(reliefAngle);
  servoStates[i] = STALL_RELIEF;
  lastMoveTime[i] = now;
}

static void manageAllServoMovements(const unsigned long now) {
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    switch (servoStates[i]) {
      case MOVING: {
        if ((unsigned long)(now - lastMoveTime[i]) > SERVO_SETTLE_TIME) {
          const bool isOpen  = (currentLimitSwitchStates[i][0] == 1);
          const bool isClose = (currentLimitSwitchStates[i][1] == 1);
          const bool goingOpen = (servoDir[i] < 0);
          if ((goingOpen && isOpen) || (!goingOpen && isClose)) {
            int relief = targetAngles[i] + (goingOpen ? STALL_RELIEF_ANGLE : -STALL_RELIEF_ANGLE);
            enterStallRelief(i, relief, now);
          } else {
            servoStates[i] = goingOpen ? INCHING_OPEN : INCHING_CLOSED;
          }
        }
      } break;

      case INCHING_OPEN:
        if (currentLimitSwitchStates[i][0] == 1) {
          int relief = targetAngles[i] + STALL_RELIEF_ANGLE;
          enterStallRelief(i, relief, now);
        } else if ((unsigned long)(now - lastMoveTime[i]) > INCHING_INTERVAL) {
          targetAngles[i] = (uint8_t)max(0, (int)targetAngles[i] - 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;

      case INCHING_CLOSED:
        if (currentLimitSwitchStates[i][1] == 1) {
          int relief = targetAngles[i] - STALL_RELIEF_ANGLE;
          enterStallRelief(i, relief, now);
        } else if ((unsigned long)(now - lastMoveTime[i]) > INCHING_INTERVAL) {
          targetAngles[i] = (uint8_t)min(180, (int)targetAngles[i] + 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;

      case STALL_RELIEF:
        if ((unsigned long)(now - lastMoveTime[i]) > STALL_RELIEF_TIME) {
          servoStates[i] = IDLE;
          servoDir[i] = 0;
          servos[i].detach();
        }
        break;

      case IDLE:
      default:
        break;
    }
  }
}

// ========================= 스위치 스냅샷 =========================
static void updateLimitSwitchStates() {
#if FAST_LIMIT_IO
  // PULLUP: 눌림=LOW → 반전해서 눌림=1
  uint8_t a = ~PINA; // D22..D29 → PA0..PA7
  uint8_t c = ~PINC; // D30..D37 → PC7..PC0

  // V0..V3: D22..D29 = PA0..PA7 (짝수=open, 홀수=closed)
  for (uint8_t i = 0; i < 4; ++i) {
    uint8_t bits = (a >> (i * 2));
    currentLimitSwitchStates[i][0] = bits & 0x01;        // OPEN
    currentLimitSwitchStates[i][1] = (bits >> 1) & 0x01; // CLOSED
  }
  // V4..V6: D30..D35 = PC7..PC2
  currentLimitSwitchStates[4][0] = (c >> 7) & 1; // D30(PC7) OPEN
  currentLimitSwitchStates[4][1] = (c >> 6) & 1; // D31(PC6) CLOSED
  currentLimitSwitchStates[5][0] = (c >> 5) & 1; // D32(PC5) OPEN
  currentLimitSwitchStates[5][1] = (c >> 4) & 1; // D33(PC4) CLOSED
  currentLimitSwitchStates[6][0] = (c >> 3) & 1; // D34(PC3) OPEN
  currentLimitSwitchStates[6][1] = (c >> 2) & 1; // D35(PC2) CLOSED
#else
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    currentLimitSwitchStates[i][0] = (uint8_t)!digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = (uint8_t)!digitalRead(limitSwitchPins[i][1]);
  }
#endif
}

// ========================= ADC 유틸 =========================
// 간단 평균(4샘플). 필요시 프리런 ADC로 변경 가능.
static inline uint16_t readAdcAvg4(uint8_t pin) {
  uint16_t sum = analogRead(pin);
  sum += analogRead(pin);
  sum += analogRead(pin);
  sum += analogRead(pin);
  return (sum >> 2);
}

// ========================= 센서 전송 =========================
static void readAndSendAllSensorData(const unsigned long now) {
  // --- 유량: 실제 dt + EWMA(Q15) ---
  const unsigned long dtMs_ul = now - lastFlowCalcMs; lastFlowCalcMs = now;
  const uint16_t dtMs = (dtMs_ul > 0) ? (uint16_t)min(dtMs_ul, (unsigned long)65535UL) : (uint16_t)SENSOR_READ_INTERVAL;
  const uint16_t aQ15 = alphaQ15_from_dt(dtMs);

  unsigned long counts[NUM_FLOW_SENSORS];
  noInterrupts();
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    counts[i] = pulseCounts[i];
    pulseCounts[i] = 0;
  }
  interrupts();

  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    int32_t inst_m3h_1e4 = 0;
    if (counts[i] > 0) {
      // inst = counts * A / dtMs (A는 m3/h*1e4)
      uint64_t num = (uint64_t)counts[i] * (uint64_t)FLOW_A_1e4[i];
      inst_m3h_1e4 = (int32_t)((num + (dtMs/2)) / dtMs); // 반올림
    }
    // EWMA: y += (x - y) * alphaQ15
    int32_t err = inst_m3h_1e4 - flowRates_m3h_1e4[i];
    int32_t delta = (int32_t)(((int64_t)err * aQ15 + 16384) >> 15); // +0.5 for rounding
    flowRates_m3h_1e4[i] += delta;
  }

#if PACKED_SERIAL
  size_t p = 0;

  // 압력(psi, 2dec) - 정수 스케일
  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) {
    const uint16_t adc = readAdcAvg4(pressurePins[i]);
    const uint32_t psi100 = ((uint32_t)adc * PSI_PER_ADC_X1000 + 5) / 10; // /10 with rounding
    bufPutChar(p, 'p'); bufPutChar(p, 't'); bufPutUInt(p, i+1); bufPutChar(p, ':');
    bufPutFixed(p, (int32_t)psi100, 2);
    bufPutChar(p, ',');
  }

  // TC1, TC2(K, 2dec) - m°C -> K*100 = (mC + 273150) / 10
  bufPutStr(p, "tc1:");
  if (tempCelsius_mC_1 == INT32_MIN) { bufPutStr(p, "ERR"); }
  else {
    const int32_t k100 = (tempCelsius_mC_1 + 273150) / 10;
    bufPutFixed(p, k100, 2);
  }
  bufPutChar(p, ',');
  bufPutStr(p, "tc2:");
  if (tempCelsius_mC_2 == INT32_MIN) { bufPutStr(p, "ERR"); }
  else {
    const int32_t k100 = (tempCelsius_mC_2 + 273150) / 10;
    bufPutFixed(p, k100, 2);
  }

  // 유량 (m3/h 4dec, L/h 1dec) - M_1e4 그대로 사용
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    bufPutStr(p, ",fm"); bufPutUInt(p, i+1); bufPutStr(p, "_m3h:");
    bufPutFixed(p, flowRates_m3h_1e4[i], 4);

    // L/h 1dec: Lh*10 == M*10000 == M_1e4
    bufPutStr(p, ",fm"); bufPutUInt(p, i+1); bufPutStr(p, "_Lh:");
    bufPutFixed(p, flowRates_m3h_1e4[i], 1);
  }

  // 리미트 스위치
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    bufPutStr(p, ",V"); bufPutUInt(p, i); bufPutStr(p, "_LS_OPEN:");
    bufPutUInt(p, currentLimitSwitchStates[i][0]);
    bufPutStr(p, ",V"); bufPutUInt(p, i); bufPutStr(p, "_LS_CLOSED:");
    bufPutUInt(p, currentLimitSwitchStates[i][1]);
  }

  bufEndlineAndSend(p);

#else
  // (참고: PACKED_SERIAL=0일 때만 사용)
  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) {
    const uint16_t adc = readAdcAvg4(pressurePins[i]);
    const uint32_t psi100 = ((uint32_t)adc * PSI_PER_ADC_X1000 + 5) / 10;
    Serial.print(F("pt")); Serial.print(i+1); Serial.print(':'); Serial.print(psi100 / 100.0f, 2); Serial.print(',');
  }
  Serial.print(F("tc1:"));
  if (tempCelsius_mC_1 == INT32_MIN) Serial.print(F("ERR"));
  else { const float k1 = (tempCelsius_mC_1 + 273150) / 100.0f; Serial.print(k1, 2); }
  Serial.print(',');
  Serial.print(F("tc2:"));
  if (tempCelsius_mC_2 == INT32_MIN) Serial.print(F("ERR"));
  else { const float k2 = (tempCelsius_mC_2 + 273150) / 100.0f; Serial.print(k2, 2); }

  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    const float m3h = flowRates_m3h_1e4[i] / 10000.0f;
    const float Lh  = m3h * 1000.0f;
    Serial.print(F(",fm")); Serial.print(i+1); Serial.print(F("_m3h:")); Serial.print(m3h, 4);
    Serial.print(F(",fm")); Serial.print(i+1); Serial.print(F("_Lh:"));  Serial.print(Lh, 1);
  }
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    Serial.print(F(",V")); Serial.print(i); Serial.print(F("_LS_OPEN:"));   Serial.print(currentLimitSwitchStates[i][0]);
    Serial.print(F(",V")); Serial.print(i); Serial.print(F("_LS_CLOSED:")); Serial.print(currentLimitSwitchStates[i][1]);
  }
  Serial.println();
#endif
}

// ========================= 온도 센서 읽기 =========================
static void updateTemperatureReadings() {
  static bool toggle = false;
  if (toggle) {
    float c1 = (float)thermocouple1.readCelsius();
    if (!isnan(c1)) {
      long v = (long)(c1 * 1000.0f + (c1 >= 0 ? 0.5f : -0.5f)); // m°C
      tempCelsius_mC_1 = (int32_t)v;
    } else {
      tempCelsius_mC_1 = INT32_MIN; // ERR 표시
    }
  } else {
    float c2 = (float)thermocouple2.readCelsius();
    if (!isnan(c2)) {
      long v = (long)(c2 * 1000.0f + (c2 >= 0 ? 0.5f : -0.5f)); // m°C
      tempCelsius_mC_2 = (int32_t)v;
    } else {
      tempCelsius_mC_2 = INT32_MIN; // ERR 표시
    }
  }
  toggle = !toggle;
}
