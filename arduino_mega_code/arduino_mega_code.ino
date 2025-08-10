// =================================================================
// Gorocket-Control-System-GUI 용 최종 통합 아두이노 코드 (MEGA)
// [업데이트]
//  - loop()에서 millis() 1회 캐시
//  - Serial.setTimeout(20)으로 parseInt 블로킹 최소화
//  - 압력센서 4샘플 평균
//  - MAX6675 2채널(tc1, tc2) 지원
//  - 유량 센서 2채널(D2/D3) 지원 + 실제 dt기반 계산 + EWMA 필터
// =================================================================

#include <SPI.h>
#include <Servo.h>
#include "MAX6675.h"

// =========================== 서보 모터 설정 ===========================
#define NUM_SERVOS 7
const int initialOpenAngles[NUM_SERVOS]   = {9, 9, 9, 9, 9, 9, 9};
const int initialClosedAngles[NUM_SERVOS] = {96, 96, 96, 96, 96, 96, 96};
const int servoPins[NUM_SERVOS]           = {13, 12, 11, 10, 9, 8, 7};
Servo servos[NUM_SERVOS];

// =========================== 상태 머신 ===========================
enum ServoState { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED };
ServoState servoStates[NUM_SERVOS];
int targetAngles[NUM_SERVOS];
unsigned long lastMoveTime[NUM_SERVOS];

#define SERVO_SETTLE_TIME 500 // ms
#define INCHING_INTERVAL  50  // ms

// =========================== 압력 센서 ===========================
#define NUM_PRESSURE_SENSORS 4
#define MAX_PRESSURE_BAR 100.0
#define BAR_TO_PSI 14.50377f
const int pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};

// =========================== MAX6675 ===========================
#define TC_SO_PIN   50
#define TC_SCK_PIN  52
#define TC1_CS_PIN  49
#define TC2_CS_PIN  48
MAX6675 thermocouple1(TC1_CS_PIN, TC_SO_PIN, TC_SCK_PIN);
MAX6675 thermocouple2(TC2_CS_PIN, TC_SO_PIN, TC_SCK_PIN);

// =========================== 리미트 스위치 ===========================
const int limitSwitchPins[NUM_SERVOS][2] = {
  { 22, 23 }, { 24, 25 }, { 26, 27 }, { 28, 29 },
  { 30, 31 }, { 32, 33 }, { 34, 35 }
};
int currentLimitSwitchStates[NUM_SERVOS][2] = {0};

// =========================== 유량 센서 ===========================
#define NUM_FLOW_SENSORS 2
const int flowSensorPins[NUM_FLOW_SENSORS] = {2, 3}; // D2(INT0), D3(INT1)

// ★ 센서 K-factor(펄스/㎥) — 센서 스펙에 맞춰 조정
const float kFactors[NUM_FLOW_SENSORS] = {450000.0f, 450000.0f};

// ISR 카운터
volatile unsigned long pulseCounts[NUM_FLOW_SENSORS] = {0, 0};

// 계산 유량(㎥/h) 저장 + 필터
float flowRates_m3_h[NUM_FLOW_SENSORS] = {0.0f, 0.0f};

// 유량 샘플링 주기 관리(실제 경과시간 사용)
#define SENSOR_READ_INTERVAL 100  // 호출 주기 목표(ms)
unsigned long lastSensorReadTime = 0;
unsigned long lastFlowCalcMs     = 0;

// EWMA 필터 상수 (밀리초). 작을수록 빠르게, 클수록 부드럽게.
#define FLOW_EWMA_TAU_MS 300

// =========================== ISR ===========================
void countPulse1() { pulseCounts[0]++; }
void countPulse2() { pulseCounts[1]++; }

// =================================================================

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(20);
  Serial.println(F("Arduino Mega: Controller (Dual MAX6675 + Dual Flow) Initializing..."));

  SPI.begin();
  thermocouple1.begin();
  thermocouple2.begin();

  for (int i = 0; i < NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach();
    servoStates[i] = IDLE;
  }

  // 유량 센서 인터럽트
  pinMode(flowSensorPins[0], INPUT_PULLUP);
  pinMode(flowSensorPins[1], INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[0]), countPulse1, RISING);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[1]), countPulse2, RISING);

  lastFlowCalcMs = millis();

  Serial.println(F("Initialization complete. System ready."));
}

void loop() {
  const unsigned long now = millis();

  if (Serial.available() > 0) {
    char c = Serial.peek();
    if (c == 'H') {
      String line = Serial.readStringUntil('\n');
      line.trim();
      if (line == "HELLO") {
        Serial.println(F("READY"));
      }
    } else if (c == 'V') {
      handleValveCommand();
    } else {
      Serial.readStringUntil('\n'); // 알 수 없는 라인 플러시
    }
  }

  updateLimitSwitchStates();
  manageAllServoMovements(now);

  if (now - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = now;
    readAndSendAllSensorData(now);
  }
}

// ========================= 시리얼 제어 =========================
void handleValveCommand() {
  if (Serial.read() != 'V') { while (Serial.available() > 0) Serial.read(); return; }
  if (Serial.read() != ',') { while (Serial.available() > 0) Serial.read(); return; }

  int servoIndex = Serial.parseInt();

  if (Serial.read() == ',') {
    char stateCmd = Serial.read();
    if (servoIndex >= 0 && servoIndex < NUM_SERVOS && servoStates[servoIndex] == IDLE) {
      servos[servoIndex].attach(servoPins[servoIndex], 500, 2500);
      delay(10); // 짧은 안정화

      if (stateCmd == 'O') {
        targetAngles[servoIndex] = initialOpenAngles[servoIndex];
      } else if (stateCmd == 'C') {
        targetAngles[servoIndex] = initialClosedAngles[servoIndex];
      }

      servos[servoIndex].write(targetAngles[servoIndex]);
      servoStates[servoIndex] = MOVING;
      lastMoveTime[servoIndex] = millis();
    }
  }
  while (Serial.available() > 0 && Serial.read() != '\n');
}

// ========================= 서보 상태 머신 =========================
void manageAllServoMovements(const unsigned long now) {
  for (int i = 0; i < NUM_SERVOS; i++) {
    switch (servoStates[i]) {
      case MOVING: {
        if (now - lastMoveTime[i] > SERVO_SETTLE_TIME) {
          bool isOpen  = (currentLimitSwitchStates[i][0] == 1);
          bool isClose = (currentLimitSwitchStates[i][1] == 1);

          if ((targetAngles[i] < 50 && isOpen) || (targetAngles[i] > 50 && isClose)) {
            servoStates[i] = IDLE;
            servos[i].detach();
          } else {
            servoStates[i] = (targetAngles[i] < 50) ? INCHING_OPEN : INCHING_CLOSED;
          }
        }
        break;
      }
      case INCHING_OPEN: {
        if (currentLimitSwitchStates[i][0] == 1) {
          servoStates[i] = IDLE; servos[i].detach();
        } else if (now - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = max(0, targetAngles[i] - 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;
      }
      case INCHING_CLOSED: {
        if (currentLimitSwitchStates[i][1] == 1) {
          servoStates[i] = IDLE; servos[i].detach();
        } else if (now - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = min(180, targetAngles[i] + 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;
      }
      case IDLE:
      default: break;
    }
  }
}

// ========================= 스위치 스냅샷 =========================
void updateLimitSwitchStates() {
  for (int i = 0; i < NUM_SERVOS; i++) {
    currentLimitSwitchStates[i][0] = !digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = !digitalRead(limitSwitchPins[i][1]);
  }
}

// ========================= 센서 전송 =========================
void readAndSendAllSensorData(const unsigned long now) {
  // ---- 유량: 실제 dt 기반 계산 + EWMA 필터 ----
  const unsigned long dtMs = now - lastFlowCalcMs;
  lastFlowCalcMs = now;
  const float dtSec = (dtMs > 0) ? (dtMs / 1000.0f) : (SENSOR_READ_INTERVAL / 1000.0f);
  const float alpha = dtMs / float(FLOW_EWMA_TAU_MS + dtMs); // 0~1

  unsigned long counts[NUM_FLOW_SENSORS];
  noInterrupts();
  for (int i = 0; i < NUM_FLOW_SENSORS; i++) {
    counts[i] = pulseCounts[i];
    pulseCounts[i] = 0;
  }
  interrupts();

  for (int i = 0; i < NUM_FLOW_SENSORS; i++) {
    float freq = (dtSec > 0) ? (counts[i] / dtSec) : 0.0f; // Hz
    float inst_m3_h = (kFactors[i] > 0.0f) ? (3600.0f * (freq / kFactors[i])) : 0.0f;
    // EWMA 필터로 부드럽게
    flowRates_m3_h[i] = flowRates_m3_h[i] + alpha * (inst_m3_h - flowRates_m3_h[i]);
  }

  // ---- 압력: 4샘플 평균 ----
  for (int i = 0; i < NUM_PRESSURE_SENSORS; i++) {
    long sum = 0; for (int k = 0; k < 4; k++) sum += analogRead(pressurePins[i]);
    int adcValue = (int)(sum >> 2);
    float pressurePsi = (float)adcValue / 1023.0f * MAX_PRESSURE_BAR * BAR_TO_PSI;
    Serial.print(F("pt")); Serial.print(i + 1); Serial.print(':'); Serial.print(pressurePsi, 2); Serial.print(',');
  }

  // ---- TC1 ----
  int status1 = thermocouple1.read();
  Serial.print(F("tc1:"));
  if (status1 == STATUS_OK) {
    float tempK1 = thermocouple1.getCelsius() + 273.15f;
    Serial.print(tempK1, 2);
  } else if (status1 == STATUS_OPEN) {
    Serial.print(F("OPEN_ERR"));
  } else {
    Serial.print(F("COM_ERR"));
  }
  Serial.print(',');

  // ---- TC2 ----
  int status2 = thermocouple2.read();
  Serial.print(F("tc2:"));
  if (status2 == STATUS_OK) {
    float tempK2 = thermocouple2.getCelsius() + 273.15f;
    Serial.print(tempK2, 2);
  } else if (status2 == STATUS_OPEN) {
    Serial.print(F("OPEN_ERR"));
  } else {
    Serial.print(F("COM_ERR"));
  }

  // ---- 유량 출력 (m3/h, L/h) ----
  for (int i = 0; i < NUM_FLOW_SENSORS; i++) {
    float Lh = flowRates_m3_h[i] * 1000.0f;
    Serial.print(F(",fm")); Serial.print(i + 1); Serial.print(F("_m3h:")); Serial.print(flowRates_m3_h[i], 4);
    Serial.print(F(",fm")); Serial.print(i + 1); Serial.print(F("_Lh:"));  Serial.print(Lh, 1);
  }

  // ---- 리미트 스위치 상태 ----
  for (int i = 0; i < NUM_SERVOS; i++) {
    Serial.print(F(",V")); Serial.print(i); Serial.print(F("_LS_OPEN:"));   Serial.print(currentLimitSwitchStates[i][0]);
    Serial.print(F(",V")); Serial.print(i); Serial.print(F("_LS_CLOSED:")); Serial.print(currentLimitSwitchStates[i][1]);
  }
  Serial.println();
}
