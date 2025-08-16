// =================================================================
// Gorocket-Control-System-GUI (MEGA)
// - Dual MAX6675 (Adafruit 라이브러리 사용)
// - Dual Flow (D2/D3, 18V→분압 입력)
// - 실제 dt 기반 유량 계산 + EWMA + ISR 글리치 필터
// - 견고한 시리얼 파서(라인 버퍼)로 HELLO 핸드셰이크 안정화
// - K = 1484.11 pulse/L → 1,484,110 pulse/m³ 적용
// - 온도센서 문제 해결: Adafruit MAX6675 라이브러리로 변경
// =================================================================
#include <SPI.h>
#include <Servo.h>
#include "max6675.h"

// =========================== 서보 ===========================
#define NUM_SERVOS 7
const int initialOpenAngles[NUM_SERVOS]   = {7,25,12,13,27,39,45};
const int initialClosedAngles[NUM_SERVOS] = {103,121,105,117,129,135,135};
const int servoPins[NUM_SERVOS]           = {13,12,11,10,9,8,7};
Servo servos[NUM_SERVOS];

enum ServoState { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED };
ServoState servoStates[NUM_SERVOS];
int targetAngles[NUM_SERVOS];
unsigned long lastMoveTime[NUM_SERVOS];
#define SERVO_SETTLE_TIME 500
#define INCHING_INTERVAL  50

// =========================== 압력 ===========================
#define NUM_PRESSURE_SENSORS 4
#define MAX_PRESSURE_BAR 100.0
#define BAR_TO_PSI 14.50377f
const int pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};

// =========================== MAX6675 ===========================
#define TC_SO_PIN  50
#define TC_SCK_PIN 52
#define TC1_CS_PIN 49
#define TC2_CS_PIN 48
MAX6675 thermocouple1(TC_SCK_PIN, TC1_CS_PIN, TC_SO_PIN);
MAX6675 thermocouple2(TC_SCK_PIN, TC2_CS_PIN, TC_SO_PIN);

// =========================== 리미트 스위치 ===========================
const int limitSwitchPins[NUM_SERVOS][2] = {
  {22,23},{24,25},{26,27},{28,29},{30,31},{32,33},{34,35}
};
int currentLimitSwitchStates[NUM_SERVOS][2] = {0};

// =========================== 유량(분압 입력) ===========================
#define NUM_FLOW_SENSORS 2
const int flowSensorPins[NUM_FLOW_SENSORS] = {2, 3}; // D2(INT0), D3(INT1)

// ---- K 적용 구간 ----
// 센서 K: 1484.11 pulse/L  →  m³당 펄스(×1000)로 변환해 사용
#define K_PULSE_PER_L 1484.11f
// k-factor: pulses per m^3
const float kFactors[NUM_FLOW_SENSORS] = { K_PULSE_PER_L * 1000.0f, K_PULSE_PER_L * 1000.0f };
// ----------------------

// ISR 공유 변수
volatile unsigned long pulseCounts[NUM_FLOW_SENSORS] = {0,0};
// 글리치 필터(최소 펄스 간격) us
#define MIN_PULSE_US 100
volatile unsigned long lastPulseMicros[NUM_FLOW_SENSORS] = {0,0};

// 계산값/타이밍
float flowRates_m3_h[NUM_FLOW_SENSORS] = {0.0f, 0.0f};
float tempCelsius1 = 0.0f;  // TC1 온도 저장
float tempCelsius2 = 0.0f;  // TC2 온도 저장
#define SENSOR_READ_INTERVAL 100
#define TEMP_READ_INTERVAL 250  // MAX6675 최소 간격
unsigned long lastSensorReadTime = 0;
unsigned long lastTempReadTime = 0;
unsigned long lastFlowCalcMs     = 0;
// EWMA 필터 타임콘스턴트(ms)
#define FLOW_EWMA_TAU_MS 300

// =========================== 시리얼 파서(라인 버퍼) ===========================
// - 개행(\n) 기준. CRLF 허용( \r 무시 ).
// - 개행이 안 오는 송신측도 고려: 마지막 바이트 이후 200ms 지나면 라인 완료로 간주.
// - “HELLO” 또는 “H” → “READY” 응답. 대소문자 무시.
static char  cmdBuf[96];
static size_t cmdLen = 0;
static unsigned long lastByteMs = 0;
#define LINE_IDLE_COMMIT_MS 200

void processCommandLine(const char* raw);
void readSerialCommands();
void updateTemperatureReadings();

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
  // readStringUntil 타임아웃 의존 제거 → setTimeout은 의미 없음. 남겨둬도 무해.
  Serial.setTimeout(200);

  // 부트 직후 PC 쪽 잔여 바이트 제거
  while (Serial.available()) { Serial.read(); }
  delay(50);

  Serial.println(F("BOOT")); // GUI 디버깅에 유용(선택)

  // MAX6675 초기화 - Adafruit 라이브러리는 자동으로 SPI 설정함
  delay(500); // MAX6675 안정화 대기

  for (int i=0; i<NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach(); // 제어 신호만 분리 (전원 차단 아님)
    servoStates[i] = IDLE;
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

  // 온도센서 별도 타이밍으로 읽기
  if (now - lastTempReadTime >= TEMP_READ_INTERVAL) {
    lastTempReadTime = now;
    updateTemperatureReadings();
  }

  if (now - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = now;
    readAndSendAllSensorData(now);
  }
}

// ========================= 시리얼 처리 =========================
void readSerialCommands() {
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

  // 개행이 오지 않는 상대(예: “HELLO”만 보내고 개행 X) 대비
  if (cmdLen > 0 && (millis() - lastByteMs) > LINE_IDLE_COMMIT_MS) {
    cmdBuf[cmdLen] = '\0';
    processCommandLine(cmdBuf);
    cmdLen = 0;
  }
}

void processCommandLine(const char* raw) {
  String line = String(raw);
  line.trim();
  if (line.length() == 0) return;

  // 대소문자 무시
  line.toUpperCase();

  // --- 핸드셰이크 ---
  if (line == "HELLO" || line == "H") {
    Serial.println(F("READY"));
    return;
  }

  // --- 밸브 제어: V,<index>,<O|C> ---
  if (line.startsWith("V,")) {
    int first = line.indexOf(',');
    int second = line.indexOf(',', first + 1);
    if (first > 0 && second > first) {
      int servoIndex = line.substring(first + 1, second).toInt();
      char stateCmd = 0;
      if (second + 1 < (int)line.length()) stateCmd = line.charAt(second + 1);

      if (servoIndex >= 0 && servoIndex < NUM_SERVOS && servoStates[servoIndex] == IDLE) {
        servos[servoIndex].attach(servoPins[servoIndex], 500, 2500);
        delay(10);
        targetAngles[servoIndex] = (stateCmd == 'O') ? initialOpenAngles[servoIndex] : initialClosedAngles[servoIndex];
        servos[servoIndex].write(targetAngles[servoIndex]);
        servoStates[servoIndex] = MOVING;
        lastMoveTime[servoIndex] = millis();
        Serial.print(F("VACK,")); Serial.print(servoIndex); Serial.print(',');
        Serial.println((stateCmd == 'O') ? F("O") : F("C"));
      } else {
        Serial.println(F("VERR"));
      }
    }
    return;
  }

  // --- 핑/퐁(선택) ---
  if (line == "PING") { Serial.println(F("PONG")); return; }

  // 기타: 알 수 없는 명령
  Serial.println(F("ERR_CMD"));
}

// ========================= 서보 상태 머신 =========================
void manageAllServoMovements(const unsigned long now) {
  for (int i=0;i<NUM_SERVOS;i++) {
    switch (servoStates[i]) {
      case MOVING:
        if (now - lastMoveTime[i] > SERVO_SETTLE_TIME) {
          bool isOpen  = (currentLimitSwitchStates[i][0] == 1);
          bool isClose = (currentLimitSwitchStates[i][1] == 1);
          if ((targetAngles[i] < 50 && isOpen) || (targetAngles[i] > 50 && isClose)) {
            servoStates[i] = IDLE; servos[i].detach();
          } else {
            servoStates[i] = (targetAngles[i] < 50) ? INCHING_OPEN : INCHING_CLOSED;
          }
        }
        break;
      case INCHING_OPEN:
        if (currentLimitSwitchStates[i][0] == 1) { servoStates[i]=IDLE; servos[i].detach(); }
        else if (now - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = max(0, targetAngles[i]-1);
          servos[i].write(targetAngles[i]); lastMoveTime[i]=now;
        }
        break;
      case INCHING_CLOSED:
        if (currentLimitSwitchStates[i][1] == 1) { servoStates[i]=IDLE; servos[i].detach(); }
        else if (now - lastMoveTime[i] > INCHING_INTERVAL) {
          targetAngles[i] = min(180, targetAngles[i]+1);
          servos[i].write(targetAngles[i]); lastMoveTime[i]=now;
        }
        break;
      case IDLE: default: break;
    }
  }
}

// ========================= 스위치 스냅샷 =========================
void updateLimitSwitchStates() {
  for (int i=0;i<NUM_SERVOS;i++) {
    currentLimitSwitchStates[i][0] = !digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = !digitalRead(limitSwitchPins[i][1]);
  }
}

// ========================= 센서 전송 =========================
void readAndSendAllSensorData(const unsigned long now) {
  // --- 유량: 실제 dt + EWMA ---
  const unsigned long dtMs = now - lastFlowCalcMs; lastFlowCalcMs = now;
  const float dtSec = dtMs > 0 ? dtMs / 1000.0f : SENSOR_READ_INTERVAL / 1000.0f;
  const float alpha = dtMs / float(FLOW_EWMA_TAU_MS + dtMs);

  unsigned long counts[NUM_FLOW_SENSORS];
  noInterrupts();
  for (int i=0;i<NUM_FLOW_SENSORS;i++){ counts[i]=pulseCounts[i]; pulseCounts[i]=0; }
  interrupts();

  for (int i=0;i<NUM_FLOW_SENSORS;i++){
    float freq = (dtSec>0) ? (counts[i]/dtSec) : 0.0f;          // Hz
    float inst_m3_h = (kFactors[i]>0.0f) ? (3600.0f*(freq/kFactors[i])) : 0.0f;
    flowRates_m3_h[i] = flowRates_m3_h[i] + alpha*(inst_m3_h - flowRates_m3_h[i]);
  }

  // 압력(4샘플 평균)
  for (int i=0;i<NUM_PRESSURE_SENSORS;i++){
    long sum=0; for(int k=0;k<4;k++) sum+=analogRead(pressurePins[i]);
    int adc = (int)(sum>>2);
    float psi = (float)adc/1023.0f*MAX_PRESSURE_BAR*BAR_TO_PSI;
    Serial.print(F("pt")); Serial.print(i+1); Serial.print(':'); Serial.print(psi,2); Serial.print(',');
  }

  // TC1 - 저장된 온도값 사용
  Serial.print(F("tc1:"));
  if (isnan(tempCelsius1)) {
    Serial.print(F("ERR"));
  } else {
    float k = tempCelsius1 + 273.15f;
    Serial.print(k,2);
  }
  Serial.print(',');

  // TC2 - 저장된 온도값 사용
  Serial.print(F("tc2:"));
  if (isnan(tempCelsius2)) {
    Serial.print(F("ERR"));
  } else {
    float k = tempCelsius2 + 273.15f;
    Serial.print(k,2);
  }

  // 유량 (m3/h, L/h)
  for (int i=0;i<NUM_FLOW_SENSORS;i++){
    float Lh = flowRates_m3_h[i]*1000.0f;
    Serial.print(F(",fm")); Serial.print(i+1); Serial.print(F("_m3h:")); Serial.print(flowRates_m3_h[i],4);
    Serial.print(F(",fm")); Serial.print(i+1); Serial.print(F("_Lh:"));  Serial.print(Lh,1);
  }

  // 리미트 스위치
  for (int i=0;i<NUM_SERVOS;i++){
    Serial.print(F(",V")); Serial.print(i); Serial.print(F("_LS_OPEN:"));   Serial.print(currentLimitSwitchStates[i][0]);
    Serial.print(F(",V")); Serial.print(i); Serial.print(F("_LS_CLOSED:")); Serial.print(currentLimitSwitchStates[i][1]);
  }
  Serial.println();
}

// ========================= 온도 센서 읽기 =========================
void updateTemperatureReadings() {
  // TC1
  double celsius1 = thermocouple1.readCelsius();
  if (!isnan(celsius1)) {
    tempCelsius1 = celsius1;
  }
  
  // TC2  
  double celsius2 = thermocouple2.readCelsius();
  if (!isnan(celsius2)) {
    tempCelsius2 = celsius2;
  }
}
