// =================================================================
// Gorocket-Control-System-GUI (MEGA) - Optimized
// - Dual MAX6675 (Adafruit 라이브러리 사용)
// - Dual Flow (D2/D3, 18V→분압 입력)
// - 실제 dt 기반 유량 계산 + EWMA + ISR 글리치 필터
// - 견고한 시리얼 파서(라인 버퍼, String 제거)로 HELLO 핸드셰이크 안정화
// - K = 1484.11 pulse/L → 1,484,110 pulse/m³ 적용
// - 온도센서 교번 읽기(부하 절감, 250ms 최소 간격 준수)
// =================================================================
#include <SPI.h>
#include <Servo.h>
#include "max6675.h"

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

#define SERVO_SETTLE_TIME   500UL
#define INCHING_INTERVAL     50UL
#define STALL_RELIEF_ANGLE     3
#define STALL_RELIEF_TIME    200UL

// =========================== 압력 ===========================
#define NUM_PRESSURE_SENSORS 4
#define MAX_PRESSURE_BAR 100.0f
#define BAR_TO_PSI       14.50377f
const uint8_t pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};
static constexpr float PSI_PER_ADC = (MAX_PRESSURE_BAR * BAR_TO_PSI) / 1023.0f; // 사전계산

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
uint8_t currentLimitSwitchStates[NUM_SERVOS][2] = {0}; // 0/1만 저장

// =========================== 유량(분압 입력) ===========================
#define NUM_FLOW_SENSORS 2
const uint8_t flowSensorPins[NUM_FLOW_SENSORS] = {2, 3}; // D2(INT0), D3(INT1)

// ---- K 적용 구간 ----
// 센서 K 계수 (pulse/L): Flow1=1484.11, Flow2=1593.79
#define K_PULSE_PER_L_FLOW1 1484.11f
#define K_PULSE_PER_L_FLOW2 1593.79f
// k-factor: pulses per m^3 (L → m³ 변환 ×1000)
const float kFactors[NUM_FLOW_SENSORS] = {
  K_PULSE_PER_L_FLOW1 * 1000.0f,
  K_PULSE_PER_L_FLOW2 * 1000.0f
};
// ----------------------

// ISR 공유 변수
volatile unsigned long pulseCounts[NUM_FLOW_SENSORS] = {0,0};
// 글리치 필터(최소 펄스 간격) us
#define MIN_PULSE_US 100UL
volatile unsigned long lastPulseMicros[NUM_FLOW_SENSORS] = {0,0};

// 계산값/타이밍
float flowRates_m3_h[NUM_FLOW_SENSORS] = {0.0f, 0.0f};
float tempCelsius1 = 0.0f;  // TC1 온도 저장
float tempCelsius2 = 0.0f;  // TC2 온도 저장
#define SENSOR_READ_INTERVAL 100UL
#define TEMP_READ_INTERVAL   250UL  // MAX6675 최소 간격
unsigned long lastSensorReadTime = 0;
unsigned long lastTempReadTime   = 0;
unsigned long lastFlowCalcMs     = 0;
// EWMA 필터 타임콘스턴트(ms)
#define FLOW_EWMA_TAU_MS 300UL

// =========================== 시리얼 파서(라인 버퍼) ===========================
// - 개행(\n) 기준. CRLF 허용( \r 무시 ).
// - 개행이 안 오는 송신측도 고려: 마지막 바이트 이후 200ms 지나면 라인 완료.
// - “HELLO” 또는 “H” → “READY” 응답. 대소문자 무시.
static char  cmdBuf[96];
static size_t cmdLen = 0;
static unsigned long lastByteMs = 0;
#define LINE_IDLE_COMMIT_MS 200UL

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
  Serial.begin(115200);
  while (Serial.available()) { Serial.read(); }
  delay(50);
  Serial.println(F("BOOT")); // GUI 디버깅에 유용(선택)

  // MAX6675 안정화 대기
  delay(500);

  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach(); // 제어 신호만 분리 (전원 차단 아님)
    servoStates[i] = IDLE;
    targetAngles[i] = 90; // 초기값
    lastMoveTime[i] = 0;
  }

  // 유량 핀: 외부 분압 푸시풀 → 내부 풀업 사용 금지
  pinMode(flowSensorPins[0], INPUT);
  pinMode(flowSensorPins[1], INPUT);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[0]), countPulse1, RISING);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[1]), countPulse2, RISING);

  lastFlowCalcMs = millis();
  Serial.println(F("READY")); // 초기 READY 알림(선택). GUI가 기다린다면 유용.
}

void loop() {
  const unsigned long now = millis();

  // 견고한 시리얼 처리
  readSerialCommands();

  updateLimitSwitchStates();
  manageAllServoMovements(now);

  // 온도센서 별도 타이밍으로 읽기(교번 읽기)
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
      // ignore CR
      continue;
    } else if (ch == '\n') {
      // 라인 완료
      cmdBuf[cmdLen] = '\0';
      if (cmdLen > 0) processCommandLine(cmdBuf);
      cmdLen = 0;
    } else {
      if (cmdLen < sizeof(cmdBuf) - 1) {
        cmdBuf[cmdLen++] = ch;
      } else {
        // 버퍼 오버런 보호: 라인 버림
        cmdLen = 0;
      }
    }
  }

  // 개행이 오지 않는 상대 대비(예: “HELLO”만 전송)
  if (cmdLen > 0 && (millis() - lastByteMs) > LINE_IDLE_COMMIT_MS) {
    cmdBuf[cmdLen] = '\0';
    processCommandLine(cmdBuf);
    cmdLen = 0;
  }
}

static void processCommandLine(char* line) {
  // 공백/탭 트림(좌우)
  // 좌측
  while (*line == ' ' || *line == '\t') ++line;
  // 우측
  char* end = line + strlen(line);
  while (end > line && (end[-1] == ' ' || end[-1] == '\t')) --end;
  *end = '\0';
  if (*line == '\0') return;

  // 대소문자 무시
  uppercaseInPlace(line);

  // --- 핸드셰이크 ---
  if (!strcmp(line, "HELLO") || !strcmp(line, "H")) {
    Serial.println(F("READY"));
    return;
  }

  // --- 밸브 제어: V,<index>,<O|C> ---
  if (line[0] == 'V' && line[1] == ',') {
    char* p = line + 2;
    // index 파싱
    char* comma = strchr(p, ',');
    if (!comma) { Serial.println(F("VERR")); return; }
    *comma = '\0';
    int servoIndex = atoi(p);
    char stateCmd = (comma[1] != '\0') ? comma[1] : 0;

    if (servoIndex >= 0 && servoIndex < NUM_SERVOS && (stateCmd == 'O' || stateCmd == 'C')) {
      if (servoStates[servoIndex] == IDLE) {
        servos[servoIndex].attach(servoPins[servoIndex], 500, 2500);
        delay(10); // 서보 초기 펄스 안정화
        targetAngles[servoIndex] = (stateCmd == 'O') ? initialOpenAngles[servoIndex] : initialClosedAngles[servoIndex];
        servos[servoIndex].write(targetAngles[servoIndex]);
        servoStates[servoIndex] = MOVING;
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

  // --- 핑/퐁(선택) ---
  if (!strcmp(line, "PING")) { Serial.println(F("PONG")); return; }

  // 기타: 알 수 없는 명령
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
          const bool goingOpen = (targetAngles[i] < 50);
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
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    // 풀업 사용 → 눌림 시 LOW → 부호 반전
    currentLimitSwitchStates[i][0] = (uint8_t)!digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = (uint8_t)!digitalRead(limitSwitchPins[i][1]);
  }
}

// ========================= 센서 전송 =========================
static inline uint16_t readAdcAvg4(uint8_t pin) {
  uint16_t sum = analogRead(pin);
  sum += analogRead(pin);
  sum += analogRead(pin);
  sum += analogRead(pin);
  return (sum >> 2);
}

static void readAndSendAllSensorData(const unsigned long now) {
  // --- 유량: 실제 dt + EWMA ---
  const unsigned long dtMs = now - lastFlowCalcMs; lastFlowCalcMs = now;
  const float dtSec = dtMs > 0 ? (dtMs * 0.001f) : (SENSOR_READ_INTERVAL * 0.001f);
  const float alpha = dtMs / float(FLOW_EWMA_TAU_MS + dtMs);

  unsigned long counts[NUM_FLOW_SENSORS];
  noInterrupts();
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    counts[i] = pulseCounts[i];
    pulseCounts[i] = 0;
  }
  interrupts();

  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    const float freq = (dtSec > 0.0f) ? (counts[i] / dtSec) : 0.0f; // Hz
    const float inst_m3_h = (kFactors[i] > 0.0f) ? (3600.0f * (freq / kFactors[i])) : 0.0f;
    flowRates_m3_h[i] += alpha * (inst_m3_h - flowRates_m3_h[i]);
  }

  // 압력(4샘플 평균) - psi 변환
  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) {
    const uint16_t adc = readAdcAvg4(pressurePins[i]);
    const float psi = adc * PSI_PER_ADC;
    Serial.print(F("pt")); Serial.print(i+1); Serial.print(':'); Serial.print(psi, 2); Serial.print(',');
  }

  // TC1 - 저장된 온도값 사용(K)
  Serial.print(F("tc1:"));
  if (isnan(tempCelsius1)) {
    Serial.print(F("ERR"));
  } else {
    const float k1 = tempCelsius1 + 273.15f;
    Serial.print(k1, 2);
  }
  Serial.print(',');

  // TC2 - 저장된 온도값 사용(K)
  Serial.print(F("tc2:"));
  if (isnan(tempCelsius2)) {
    Serial.print(F("ERR"));
  } else {
    const float k2 = tempCelsius2 + 273.15f;
    Serial.print(k2, 2);
  }

  // 유량 (m3/h, L/h)
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
}

// ========================= 온도 센서 읽기 =========================
// MAX6675는 샘플 업데이트 주기가 ~220ms 수준이므로 교번(반교차) 읽기로 부하 절감
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
