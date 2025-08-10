// =================================================================
// Gorocket-Control-System-GUI 용 최종 통합 아두이노 코드 (MEGA)
// [업데이트]
//  - loop()에서 millis() 1회 캐시
//  - Serial.setTimeout(20)으로 parseInt 블로킹 최소화
//  - 압력센서 4샘플 평균
//  - MAX6675 2채널(tc1, tc2) 지원 추가
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

// =========================== 상태 머신(State Machine) ===========================
enum ServoState { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED };
ServoState servoStates[NUM_SERVOS];
int targetAngles[NUM_SERVOS];
unsigned long lastMoveTime[NUM_SERVOS];

#define SERVO_SETTLE_TIME 500 // ms
#define INCHING_INTERVAL  50  // ms

// =========================== 센서/스위치 설정 ===========================
#define NUM_PRESSURE_SENSORS 4
#define MAX_PRESSURE_BAR 100.0
#define BAR_TO_PSI 14.50377f
const int pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};

// --- MAX6675: SO/SCK 공유, CS 2개 (49, 48) ---
#define TC_SO_PIN   50
#define TC_SCK_PIN  52
#define TC1_CS_PIN  49
#define TC2_CS_PIN  48
MAX6675 thermocouple1(TC1_CS_PIN, TC_SO_PIN, TC_SCK_PIN);
MAX6675 thermocouple2(TC2_CS_PIN, TC_SO_PIN, TC_SCK_PIN);

const int limitSwitchPins[NUM_SERVOS][2] = {
  { 22, 23 }, { 24, 25 }, { 26, 27 }, { 28, 29 },
  { 30, 31 }, { 32, 33 }, { 34, 35 }
};
int currentLimitSwitchStates[NUM_SERVOS][2] = {0};

#define SENSOR_READ_INTERVAL 100
unsigned long lastSensorReadTime = 0;

// =================================================================

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(20); // [최적화] parseInt 블로킹 최소화
  Serial.println(F("Arduino Mega: Controller (Optimized + Dual MAX6675) Initializing..."));

  SPI.begin();
  thermocouple1.begin();
  thermocouple2.begin();

  for (int i = 0; i < NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach();
    servoStates[i] = IDLE;
  }

  Serial.println(F("Initialization complete. System ready."));
}

void loop() {
  const unsigned long now = millis(); // [최적화] loop 내 공용 시간값

  if (Serial.available() > 0) {
    handleValveCommand();
  }

  // 루프당 1회 스위치 스냅샷
  updateLimitSwitchStates();

  // 서보 상태 머신 처리
  manageAllServoMovements(now);

  if (now - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = now;
    readAndSendAllSensorData();
  }
}

/**
 * @brief 시리얼 명령을 받아 서보의 목표 상태와 각도를 설정
 *        형식: V,<index>,O|C\n
 */
void handleValveCommand() {
  if (Serial.read() != 'V') { while (Serial.available() > 0) Serial.read(); return; }
  if (Serial.read() != ',') { while (Serial.available() > 0) Serial.read(); return; }

  int servoIndex = Serial.parseInt();

  if (Serial.read() == ',') {
    char stateCmd = Serial.read();
    if (servoIndex >= 0 && servoIndex < NUM_SERVOS && servoStates[servoIndex] == IDLE) {
      servos[servoIndex].attach(servoPins[servoIndex], 500, 2500);
      delay(10); // 짧은 구동 안정화

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

/**
 * @brief 모든 서보 상태 머신
 */
void manageAllServoMovements(const unsigned long now) {
  for (int i = 0; i < NUM_SERVOS; i++) {
    switch (servoStates[i]) {
      case MOVING: {
        if (now - lastMoveTime[i] > SERVO_SETTLE_TIME) {
          bool isOpenSwitchPressed   = (currentLimitSwitchStates[i][0] == 1);
          bool isClosedSwitchPressed = (currentLimitSwitchStates[i][1] == 1);

          if ((targetAngles[i] < 50 && isOpenSwitchPressed) ||
              (targetAngles[i] > 50 && isClosedSwitchPressed)) {
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
          servoStates[i] = IDLE;
          servos[i].detach();
        } else if (now - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = max(0, targetAngles[i] - 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;
      }

      case INCHING_CLOSED: {
        if (currentLimitSwitchStates[i][1] == 1) {
          servoStates[i] = IDLE;
          servos[i].detach();
        } else if (now - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = min(180, targetAngles[i] + 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;
      }

      case IDLE:
      default:
        break;
    }
  }
}

/**
 * @brief 리미트 스위치 상태 스냅샷 (루프당 1회)
 */
void updateLimitSwitchStates() {
  for (int i = 0; i < NUM_SERVOS; i++) {
    currentLimitSwitchStates[i][0] = !digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = !digitalRead(limitSwitchPins[i][1]);
  }
}

/**
 * @brief 센서 값 전송 (압력 4채널 + TC 2채널 + 스위치 상태)
 *        출력 예: pt1:123.45,pt2:...,pt3:...,pt4:...,tc1:300.12,tc2:299.98,V0_LS_OPEN:0,...\n
 */
void readAndSendAllSensorData() {
  // 압력: 4샘플 평균으로 노이즈 완화
  for (int i = 0; i < NUM_PRESSURE_SENSORS; i++) {
    long sum = 0;
    for (int k = 0; k < 4; k++) sum += analogRead(pressurePins[i]);
    int adcValue = (int)(sum >> 2); // 평균
    float pressurePsi = (float)adcValue / 1023.0 * MAX_PRESSURE_BAR * BAR_TO_PSI;
    Serial.print("pt"); Serial.print(i + 1); Serial.print(":"); Serial.print(pressurePsi, 2); Serial.print(",");
  }

  // MAX6675 #1
  int status1 = thermocouple1.read();
  Serial.print("tc1:");
  if (status1 == STATUS_OK) {
    float tempK1 = thermocouple1.getCelsius() + 273.15;
    Serial.print(tempK1, 2);
  } else if (status1 == STATUS_OPEN) {
    Serial.print("OPEN_ERR");
  } else {
    Serial.print("COM_ERR");
  }
  Serial.print(",");

  // MAX6675 #2
  int status2 = thermocouple2.read();
  Serial.print("tc2:");
  if (status2 == STATUS_OK) {
    float tempK2 = thermocouple2.getCelsius() + 273.15;
    Serial.print(tempK2, 2);
  } else if (status2 == STATUS_OPEN) {
    Serial.print("OPEN_ERR");
  } else {
    Serial.print("COM_ERR");
  }

  // 각 밸브 리미트 스위치 상태
  for (int i = 0; i < NUM_SERVOS; i++) {
    Serial.print(",V"); Serial.print(i); Serial.print("_LS_OPEN:");   Serial.print(currentLimitSwitchStates[i][0]);
    Serial.print(",V"); Serial.print(i); Serial.print("_LS_CLOSED:"); Serial.print(currentLimitSwitchStates[i][1]);
  }
  Serial.println();
}
