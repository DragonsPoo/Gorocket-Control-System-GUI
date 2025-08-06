// =================================================================
// Gorocket-Control-System-GUI 용 최종 통합 아두이노 코드
// (최종 최적화: '점진적 접근' + '루프당 1회 읽기' 원칙 적용)
//
// 최종 변경 사항:
// 1. [최적화] loop() 시작 시 모든 스위치 상태를 단 한 번만 읽도록 변경
// 2. [최적화] 다른 모든 함수에서 updateLimitSwitchStates() 호출 제거
// 3. [최적화] 센서 데이터 전송 로직에서 불필요한 연산 단순화
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

// =========================== 상태 머신(State Machine) 설정 =======================
enum ServoState { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED };

ServoState servoStates[NUM_SERVOS];
int targetAngles[NUM_SERVOS];
unsigned long lastMoveTime[NUM_SERVOS];

#define SERVO_SETTLE_TIME 500 // 볼 밸브 회전 시간을 고려한 안정화 대기 시간 (1.5초)
#define INCHING_INTERVAL 50    // 1도씩 이동할 때의 시간 간격 (ms)
// ==============================================================================

// =========================== 센서 및 스위치 설정 ===========================
#define NUM_PRESSURE_SENSORS 4
#define MAX_PRESSURE_BAR 100.0
#define BAR_TO_PSI 14.50377f
const int pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};

#define TC_SO_PIN  50
#define TC_SCK_PIN 52
#define TC_CS_PIN  49
MAX6675 thermocouple(TC_CS_PIN, TC_SO_PIN, TC_SCK_PIN);

const int limitSwitchPins[NUM_SERVOS][2] = {
  { 22, 23 }, { 24, 25 }, { 26, 27 }, { 28, 29 },
  { 30, 31 }, { 32, 33 }, { 34, 35 }
};
int currentLimitSwitchStates[NUM_SERVOS][2] = {0};

#define SENSOR_READ_INTERVAL 100
unsigned long lastSensorReadTime = 0;
// =================================================================================

void setup() {
  Serial.begin(115200);
  Serial.println("Arduino Mega: Controller (Final Optimized Ver.) Initializing...");
  
  SPI.begin();
  thermocouple.begin();

  for (int i = 0; i < NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach();
    servoStates[i] = IDLE;
  }
  
  Serial.println("Initialization complete. System ready.");
}

void loop() {
  if (Serial.available() > 0) {
    handleValveCommand();
  }

  // ★★★ 최종 최적화 적용 ★★★
  // 루프가 한 번 실행될 때, 모든 스위치 상태를 단 한 번만 읽습니다.
  updateLimitSwitchStates();

  // 이제 다른 함수들은 실제 핀을 읽는 대신, 미리 읽어둔 상태 값을 사용합니다.
  manageAllServoMovements();

  if (millis() - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = millis();
    // readAndSendAllSensorData 함수는 이제 updateLimitSwitchStates를 호출할 필요가 없습니다.
    readAndSendAllSensorData();
  }
}

/**
 * @brief 시리얼 명령을 받아 서보의 목표 상태와 각도를 설정
 */
void handleValveCommand() {
  if (Serial.read() != 'V') { while(Serial.available() > 0) Serial.read(); return; }
  if (Serial.read() != ',') { while(Serial.available() > 0) Serial.read(); return; }
  
  int servoIndex = Serial.parseInt();
  
  if (Serial.read() == ',') {
    char stateCmd = Serial.read();
    if (servoIndex >= 0 && servoIndex < NUM_SERVOS && servoStates[servoIndex] == IDLE) {
      servos[servoIndex].attach(servoPins[servoIndex], 500, 2500);
      delay(10);
      
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
  while(Serial.available() > 0 && Serial.read() != '\n');
}

/**
 * @brief 모든 서보의 상태를 관리하고 필요한 동작을 수행하는 '상태 머신'
 */
void manageAllServoMovements() {
  for (int i = 0; i < NUM_SERVOS; i++) {
    switch (servoStates[i]) {
      
      case MOVING: {
        if (millis() - lastMoveTime[i] > SERVO_SETTLE_TIME) {
          // updateLimitSwitchStates() 호출 제거
          bool isOpenSwitchPressed = (currentLimitSwitchStates[i][0] == 1);
          bool isClosedSwitchPressed = (currentLimitSwitchStates[i][1] == 1);
          
          if ((targetAngles[i] < 50 && isOpenSwitchPressed) || (targetAngles[i] > 50 && isClosedSwitchPressed)) {
            servoStates[i] = IDLE;
            servos[i].detach();
          } else {
            servoStates[i] = (targetAngles[i] < 50) ? INCHING_OPEN : INCHING_CLOSED;
          }
        }
        break;
      }

      case INCHING_OPEN: {
        // updateLimitSwitchStates() 호출 제거
        if (currentLimitSwitchStates[i][0] == 1) {
          servoStates[i] = IDLE;
          servos[i].detach();
        } else if (millis() - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = max(0, targetAngles[i] - 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = millis();
        }
        break;
      }

      case INCHING_CLOSED: {
        // updateLimitSwitchStates() 호출 제거
        if (currentLimitSwitchStates[i][1] == 1) {
          servoStates[i] = IDLE;
          servos[i].detach();
        } else if (millis() - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = min(180, targetAngles[i] + 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = millis();
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
 * @brief 모든 리미트 스위치 상태를 읽어 전역 배열에 업데이트 (루프당 1회 호출)
 */
void updateLimitSwitchStates() {
  for (int i = 0; i < NUM_SERVOS; i++) {
    currentLimitSwitchStates[i][0] = !digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = !digitalRead(limitSwitchPins[i][1]);
  }
}

/**
 * @brief 모든 센서 값을 GUI로 전송
 */
void readAndSendAllSensorData() {
  for (int i = 0; i < NUM_PRESSURE_SENSORS; i++) {
    int adcValue = analogRead(pressurePins[i]);
    float pressurePsi = (float)adcValue / 1023.0 * MAX_PRESSURE_BAR * BAR_TO_PSI;
    Serial.print("pt"); Serial.print(i + 1); Serial.print(":"); Serial.print(pressurePsi, 2); Serial.print(",");
  }

  int status = thermocouple.read();
  Serial.print("tc1:");
  if (status == STATUS_OK) {
    float tempK = thermocouple.getCelsius() + 273.15;
    Serial.print(tempK, 2);
  } else if (status == STATUS_OPEN) {
    Serial.print("OPEN_ERR");
  } else {
    Serial.print("COM_ERR");
  }

  for (int i = 0; i < NUM_SERVOS; i++) {
    Serial.print(",V"); Serial.print(i); Serial.print("_LS_OPEN:"); Serial.print(currentLimitSwitchStates[i][0]);
    Serial.print(",V"); Serial.print(i); Serial.print("_LS_CLOSED:"); Serial.print(currentLimitSwitchStates[i][1]);
  }
  Serial.println();
}