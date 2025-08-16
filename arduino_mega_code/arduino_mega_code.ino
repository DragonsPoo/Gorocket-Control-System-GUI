// =================================================================
// Gorocket-Control-System-GUI (MEGA) - Further Optimized
// - PACKED_SERIAL: 센서 라인 버퍼에 조립 후 1회 전송(부하↓, 지터↓)
// - 고정소수점 출력으로 float 포맷 부하 감소
// - 서보 진행방향 명시 저장(휴리스틱 제거)
// - 유량 계산 나눗셈 최소화(1/dtMs 사전계산)
// - 기타: delay 제거, 소소한 inline/constexpr
// =================================================================
#include <SPI.h>
#include <Servo.h>
#include <avr/io.h>
#include "max6675.h"

// =========================== 옵션 ===========================
#ifndef SERIAL_BAUD
#define SERIAL_BAUD 115200
#endif

#define FAST_LIMIT_IO   1   // 포트 직접 읽기
#define PACKED_SERIAL   1   // 1: 버퍼 조립 후 1회 전송, 0: 기존 다중 Serial.print

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
static constexpr float PSI_PER_ADC = (MAX_PRESSURE_BAR * BAR_TO_PSI) / 1023.0f;

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

// 보정 상수
#define K_PULSE_PER_L_FLOW1 1484.11f
#define K_PULSE_PER_L_FLOW2 1593.79f

// Hz → m3/h: 3.6 / K,  counts/ms → m3/h: 3600 / K
static const float Hz_to_m3h[NUM_FLOW_SENSORS] = {
  3600.0f / (K_PULSE_PER_L_FLOW1 * 1000.0f),
  3600.0f / (K_PULSE_PER_L_FLOW2 * 1000.0f)
};
static const float countsPerMs_to_m3h[NUM_FLOW_SENSORS] = {
  3600.0f / K_PULSE_PER_L_FLOW1,
  3600.0f / K_PULSE_PER_L_FLOW2
};

// ISR 공유 변수
volatile unsigned long pulseCounts[NUM_FLOW_SENSORS] = {0,0};
#define MIN_PULSE_US 100UL
volatile unsigned long lastPulseMicros[NUM_FLOW_SENSORS] = {0,0};

// 계산값/타이밍
float flowRates_m3_h[NUM_FLOW_SENSORS] = {0.0f, 0.0f};
float tempCelsius1 = 0.0f;
float tempCelsius2 = 0.0f;
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

static inline void bufPutChar(size_t &pos, char c) {
  if (pos < OUTBUF_SZ-1) outBuf[pos++] = c;
}
static inline void bufPutStr(size_t &pos, const char* s) {
  while (*s && pos < OUTBUF_SZ-1) outBuf[pos++] = *s++;
}
static inline void bufPutUInt(size_t &pos, uint32_t v) {
  char tmp[11]; // up to 4294967295
  ultoa(v, tmp, 10);
  bufPutStr(pos, tmp);
}
static inline void bufPutInt(size_t &pos, int32_t v) {
  char tmp[12];
  ltoa(v, tmp, 10);
  bufPutStr(pos, tmp);
}
// scaled(정수) / 10^decimals 출력. 예) scaled=12345,dec=2 -> "123.45"
static inline void bufPutFixed(size_t &pos, int32_t scaled, uint8_t decimals) {
  if (scaled < 0) { bufPutChar(pos, '-'); scaled = -scaled; }
  uint32_t den = POW10[decimals];
  uint32_t ip = scaled / den;
  uint32_t fp = scaled % den;
  bufPutUInt(pos, ip);
  if (decimals == 0) return;
  bufPutChar(pos, '.');
  // leading zeros for fraction
  for (int8_t d = decimals-1; d >= 0; --d) {
    uint32_t div = POW10[d];
    uint8_t digit = (fp / div) % 10;
    bufPutChar(pos, char('0' + digit));
  }
}
static inline void bufEndlineAndSend(size_t &pos) {
  outBuf[pos++] = '\n';
  outBuf[pos] = '\0';
  Serial.print(outBuf);
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

// =========================== ISR ===========================
void countPulse1() {
  unsigned long now = micros();
  if ((unsigned long)(now - lastPulseMicros[0]) >= MIN_PULSE_US) {
    pulseCounts[0]++; lastPulseMicros[0] = now;
  }
}
void countPulse2() {
  unsigned long now = micros();
  if ((unsigned long)(now - lastPulseMicros[1]) >= MIN_PULSE_US) {
    pulseCounts[1]++; lastPulseMicros[1] = now;
  }
}

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
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[0]), countPulse1, RISING);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[1]), countPulse2, RISING);

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
        // delay(10); // 제거: attach 직후 첫 펄스는 Servo 라이브러리가 생성
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
static inline uint16_t readAdcAvg4(uint8_t pin) {
  uint16_t sum = analogRead(pin);
  sum += analogRead(pin);
  sum += analogRead(pin);
  sum += analogRead(pin);
  return (sum >> 2);
}

// ========================= 센서 전송 =========================
static void readAndSendAllSensorData(const unsigned long now) {
  // --- 유량: 실제 dt + EWMA ---
  const unsigned long dtMs = now - lastFlowCalcMs; lastFlowCalcMs = now;
  const float dtMs_f = (dtMs > 0) ? (float)dtMs : (float)SENSOR_READ_INTERVAL;
  const float inv_dtMs = 1.0f / dtMs_f;
  const float alpha = dtMs_f / (FLOW_EWMA_TAU_MS + dtMs_f);

  unsigned long counts[NUM_FLOW_SENSORS];
  noInterrupts();
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    counts[i] = pulseCounts[i];
    pulseCounts[i] = 0;
  }
  interrupts();

  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    // counts/ms → m3/h
    const float inst_m3_h = (counts[i] > 0) ? (counts[i] * countsPerMs_to_m3h[i] * inv_dtMs) : 0.0f;
    flowRates_m3_h[i] += alpha * (inst_m3_h - flowRates_m3_h[i]);
  }

#if PACKED_SERIAL
  size_t p = 0;

  // 압력(psi, 2dec)
  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) {
    const uint16_t adc = readAdcAvg4(pressurePins[i]);
    const float psi = adc * PSI_PER_ADC;
    const int32_t psi100 = (int32_t)(psi * 100.0f + (psi >= 0 ? 0.5f : -0.5f));
    bufPutChar(p, 'p'); bufPutChar(p, 't'); bufPutUInt(p, i+1); bufPutChar(p, ':');
    bufPutFixed(p, psi100, 2);
    bufPutChar(p, ',');
  }

  // TC1, TC2(K, 2dec) - 저장값 사용
  bufPutStr(p, "tc1:");
  if (isnan(tempCelsius1)) { bufPutStr(p, "ERR"); }
  else {
    const float k1 = tempCelsius1 + 273.15f;
    const int32_t k100 = (int32_t)(k1 * 100.0f + (k1 >= 0 ? 0.5f : -0.5f));
    bufPutFixed(p, k100, 2);
  }
  bufPutChar(p, ',');
  bufPutStr(p, "tc2:");
  if (isnan(tempCelsius2)) { bufPutStr(p, "ERR"); }
  else {
    const float k2 = tempCelsius2 + 273.15f;
    const int32_t k100 = (int32_t)(k2 * 100.0f + (k2 >= 0 ? 0.5f : -0.5f));
    bufPutFixed(p, k100, 2);
  }

  // 유량 (m3/h 4dec, L/h 1dec)
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    const float m3h = flowRates_m3_h[i];
    const float Lh  = m3h * 1000.0f;
    const int32_t m3h1e4 = (int32_t)(m3h * 10000.0f + (m3h >= 0 ? 0.5f : -0.5f));
    const int32_t Lh1e1  = (int32_t)(Lh  * 10.0f     + (Lh  >= 0 ? 0.5f : -0.5f));

    bufPutStr(p, ",fm"); bufPutUInt(p, i+1); bufPutStr(p, "_m3h:");
    bufPutFixed(p, m3h1e4, 4);

    bufPutStr(p, ",fm"); bufPutUInt(p, i+1); bufPutStr(p, "_Lh:");
    bufPutFixed(p, Lh1e1, 1);
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
  // 압력(psi)
  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) {
    const uint16_t adc = readAdcAvg4(pressurePins[i]);
    const float psi = adc * PSI_PER_ADC;
    Serial.print(F("pt")); Serial.print(i+1); Serial.print(':'); Serial.print(psi, 2); Serial.print(',');
  }
  // TC
  Serial.print(F("tc1:"));
  if (isnan(tempCelsius1)) Serial.print(F("ERR"));
  else { const float k1 = tempCelsius1 + 273.15f; Serial.print(k1, 2); }
  Serial.print(',');
  Serial.print(F("tc2:"));
  if (isnan(tempCelsius2)) Serial.print(F("ERR"));
  else { const float k2 = tempCelsius2 + 273.15f; Serial.print(k2, 2); }

  // 유량
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    const float Lh = flowRates_m3_h[i] * 1000.0f;
    Serial.print(F(",fm")); Serial.print(i+1); Serial.print(F("_m3h:")); Serial.print(flowRates_m3_h[i], 4);
    Serial.print(F(",fm")); Serial.print(i+1); Serial.print(F("_Lh:"));  Serial.print(Lh, 1);
  }
  // 리미트 스위치
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
    if (!isnan(c1)) tempCelsius1 = c1;
  } else {
    float c2 = (float)thermocouple2.readCelsius();
    if (!isnan(c2)) tempCelsius2 = c2;
  }
  toggle = !toggle;
}
