// =================================================================
// Gorocket-Control-System-GUI (MEGA) - 최종 통합 버전 (Emergency 강제 오버라이드 반영)
// - 안전 기능: HEARTBEAT 타임아웃, 압력 한계/상승률 트립
// - 통신 안정성: CRC-8(0x07) 프레이밍 및 NACK 응답 (재시도는 상위 시스템 담당)
// - 기존 최적화 유지: ADC 프리런, 패키지 전송 등
// - 변경점: 비상 시퀀스에서 진행 중 서보도 강제로 목표 각도로 이동하도록 오버라이드 구현
// =================================================================
#include <SPI.h>
#include <Servo.h>
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/pgmspace.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include "max6675.h"

// =========================== 옵션 및 설정 ===========================
#ifndef SERIAL_BAUD
#define SERIAL_BAUD 115200
#endif

#define FAST_LIMIT_IO       1
#define PACKED_SERIAL       1
#define FAST_FLOW_ISR       1
#define FLOW_TIMER3_TICK    1
#define ADC_BG_FREERUN      1

// =========================== 안전 파라미터 ===========================
#define HEARTBEAT_TIMEOUT_MS 3000UL   // 하트비트 타임아웃 (ms)
// 압력 임계(0이면 비활성). 단위: psi*100
#define PRESSURE_MAX_PSIx100             120000UL // 예: 1200.00 psi
// 압력 상승률 임계(0이면 비활성). 단위: (psi*100)/s
#define PRESSURE_ROC_MAX_PSIx100_PER_S   5000UL   // 예: 50.00 psi/s

// =========================== CRC-8 (0x07, LUT) ===========================
static const uint8_t CRC8_TABLE[256] PROGMEM = {
  0x00,0x07,0x0E,0x09,0x1C,0x1B,0x12,0x15,0x38,0x3F,0x36,0x31,0x24,0x23,0x2A,0x2D,
  0x70,0x77,0x7E,0x79,0x6C,0x6B,0x62,0x65,0x48,0x4F,0x46,0x41,0x54,0x53,0x5A,0x5D,
  0xE0,0xE7,0xEE,0xE9,0xFC,0xFB,0xF2,0xF5,0xD8,0xDF,0xD6,0xD1,0xC4,0xC3,0xCA,0xCD,
  0x90,0x97,0x9E,0x99,0x8C,0x8B,0x82,0x85,0xA8,0xAF,0xA6,0xA1,0xB4,0xB3,0xBA,0xBD,
  0xC7,0xC0,0xC9,0xCE,0xDB,0xDC,0xD5,0xD2,0xFF,0xF8,0xF1,0xF6,0xE3,0xE4,0xED,0xEA,
  0xB7,0xB0,0xB9,0xBE,0xAB,0xAC,0xA5,0xA2,0x8F,0x88,0x81,0x86,0x93,0x94,0x9D,0x9A,
  0x27,0x20,0x29,0x2E,0x3B,0x3C,0x35,0x32,0x1F,0x18,0x11,0x16,0x03,0x04,0x0D,0x0A,
  0x57,0x50,0x59,0x5E,0x4B,0x4C,0x45,0x42,0x6F,0x68,0x61,0x66,0x73,0x74,0x7D,0x7A,
  0x89,0x8E,0x87,0x80,0x95,0x92,0x9B,0x9C,0xB1,0xB6,0xBF,0xB8,0xAD,0xAA,0xA3,0xA4,
  0xF9,0xFE,0xF7,0xF0,0xE5,0xE2,0xEB,0xEC,0xC1,0xC6,0xCF,0xC8,0xDD,0xDA,0xD3,0xD4,
  0x69,0x6E,0x67,0x60,0x75,0x72,0x7B,0x7C,0x51,0x56,0x5F,0x58,0x4D,0x4A,0x43,0x44,
  0x19,0x1E,0x17,0x10,0x05,0x02,0x0B,0x0C,0x21,0x26,0x2F,0x28,0x3D,0x3A,0x33,0x34,
  0x4E,0x49,0x40,0x47,0x52,0x55,0x5C,0x5B,0x76,0x71,0x78,0x7F,0x6A,0x6D,0x64,0x63,
  0x3E,0x39,0x30,0x37,0x22,0x25,0x2C,0x2B,0x06,0x01,0x08,0x0F,0x1A,0x1D,0x14,0x13,
  0xAE,0xA9,0xA0,0xA7,0xB2,0xB5,0xBC,0xBB,0x96,0x91,0x98,0x9F,0x8A,0x8D,0x84,0x83,
  0xDE,0xD9,0xD0,0xD7,0xC2,0xC5,0xCC,0xCB,0xE6,0xE1,0xE8,0xEF,0xFA,0xFD,0xF4,0xF3
};
static uint8_t crc8(const uint8_t *data, size_t len) {
  uint8_t crc = 0;
  for (size_t i = 0; i < len; i++) {
    crc = pgm_read_byte(&CRC8_TABLE[crc ^ data[i]]);
  }
  return crc;
}

// =========================== 서보/상수 ===========================
#define NUM_SERVOS 7
const uint8_t initialOpenAngles[NUM_SERVOS]   = {7,25,12,13,27,39,45};
const uint8_t initialClosedAngles[NUM_SERVOS] = {103,121,105,117,129,135,135};
const uint8_t servoPins[NUM_SERVOS]           = {13,12,11,10,9,8,7};
Servo servos[NUM_SERVOS];

enum ServoState : uint8_t { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED, STALL_RELIEF };
ServoState servoStates[NUM_SERVOS];
uint8_t targetAngles[NUM_SERVOS];
unsigned long lastMoveTime[NUM_SERVOS];
int8_t servoDir[NUM_SERVOS] = {0}; // -1: opening, +1: closing

// 밸브 역할 매핑 (비상 시퀀스용)
enum ServoRole : uint8_t { ROLE_MAIN=0, ROLE_VENT=1, ROLE_PURGE=2 };
const uint8_t servoRoles[NUM_SERVOS] = {
  ROLE_MAIN, ROLE_MAIN, ROLE_MAIN, ROLE_MAIN, ROLE_MAIN, // V0-V4
  ROLE_VENT,  // V5
  ROLE_PURGE  // V6
};
#define SERVO_SETTLE_TIME   500UL
#define INCHING_INTERVAL      50UL
#define STALL_RELIEF_ANGLE      3
#define STALL_RELIEF_TIME   200UL

// =========================== 압력(ADC) ===========================
#define NUM_PRESSURE_SENSORS 4
const uint8_t pressurePins[NUM_PRESSURE_SENSORS] = {A0, A1, A2, A3};
#define MAX_PRESSURE_BAR 100.0f
#define BAR_TO_PSI       14.50377f
static constexpr uint32_t PSI_PER_ADC_X1000 =
  (uint32_t)((MAX_PRESSURE_BAR * BAR_TO_PSI * 1000.0) / 1023.0 + 0.5f);

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

// =========================== 유량 ===========================
#define NUM_FLOW_SENSORS 2
const uint8_t flowSensorPins[NUM_FLOW_SENSORS] = {2, 3}; // D2(INT0), D3(INT1)
#define K_PULSE_PER_L_FLOW1 1484.11f
#define K_PULSE_PER_L_FLOW2 1593.79f
static constexpr uint32_t FLOW_A_1e4[NUM_FLOW_SENSORS] = {
  (uint32_t)((3600.0 * 10000.0) / K_PULSE_PER_L_FLOW1 + 0.5),
  (uint32_t)((3600.0 * 10000.0) / K_PULSE_PER_L_FLOW2 + 0.5)
};
volatile unsigned long pulseCounts[NUM_FLOW_SENSORS] = {0,0};
#define MIN_PULSE_US 100UL

#if FLOW_TIMER3_TICK
#define TIMER3_TICK_PER_US 2UL
#define MIN_PULSE_T3_TICKS (MIN_PULSE_US * TIMER3_TICK_PER_US)
volatile uint16_t lastPulseTicks[NUM_FLOW_SENSORS] = {0,0};
#endif

int32_t flowRates_m3h_1e4[NUM_FLOW_SENSORS] = {0, 0};
int32_t tempCelsius_mC_1 = 0;
int32_t tempCelsius_mC_2 = 0;

#define SENSOR_READ_INTERVAL 100UL
#define TEMP_READ_INTERVAL   250UL
unsigned long lastSensorReadTime = 0;
unsigned long lastTempReadTime   = 0;
unsigned long lastFlowCalcMs     = 0;
#define FLOW_EWMA_TAU_MS 300UL

// =========================== Safety 상태 ===========================
static volatile bool emergencyActive = false;
static bool heartbeatArmed = false;
static unsigned long lastHeartbeatMs = 0;

// 압력 임계 체크 상태
static uint32_t lastPsi100[NUM_PRESSURE_SENSORS] = {0,0,0,0};
static unsigned long lastPressureCheckMs = 0;

// =========================== 시리얼 파서 ===========================
static char   cmdBuf[96];
static size_t cmdLen = 0;
static unsigned long lastByteMs = 0;
#define LINE_IDLE_COMMIT_MS 200UL

// =========================== PACKED_SERIAL 버퍼 ===========================
#if PACKED_SERIAL
static constexpr size_t OUTBUF_SZ = 512;
static char outBuf[OUTBUF_SZ];
static constexpr uint32_t POW10[7] = {1UL,10UL,100UL,1000UL,10000UL,100000UL,1000000UL};
static inline void bufPutChar(size_t &pos, char c){ if(pos<OUTBUF_SZ-1) outBuf[pos++]=c; }
static inline void bufPutStr(size_t &pos, const char* s){ while(*s && pos<OUTBUF_SZ-1) outBuf[pos++]=*s++; }
static inline void bufPutUInt(size_t &pos, uint32_t v){ char tmp[11]; ultoa(v,tmp,10); bufPutStr(pos,tmp); }
static inline void bufPutFixed(size_t &pos, int32_t scaled, uint8_t decimals){
  if(scaled<0){ bufPutChar(pos,'-'); scaled=-scaled; }
  uint32_t den=POW10[decimals], ip=scaled/den, fp=scaled%den;
  bufPutUInt(pos, ip);
  if(decimals==0) return; bufPutChar(pos,'.');
  for(int8_t d=decimals-1; d>=0; --d){ uint32_t div=POW10[d]; uint8_t digit=(fp/div)%10; bufPutChar(pos, char('0'+digit)); }
}
static inline void bufEndlineAndSend(size_t &pos){ outBuf[pos++]='\n'; Serial.write((const uint8_t*)outBuf, pos); pos=0; }
#endif

// 프로토타입
static void readSerialCommands();
static void updateTemperatureReadings();
static void updateLimitSwitchStates();
static void manageAllServoMovements(const unsigned long now);
static void readAndSendAllSensorData(const unsigned long now);

// Utils
static inline uint16_t alphaQ15_from_dt(uint16_t dtMs){
  uint32_t denom=(uint32_t)FLOW_EWMA_TAU_MS + (uint32_t)dtMs;
  if(denom==0) return 0;
  uint32_t a=((uint32_t)dtMs << 15)/denom; if(a>32767U) a=32767U;
  return (uint16_t)a;
}

// =========================== FLOW ISR ===========================
#if FAST_FLOW_ISR
static inline void handleFlowPulse(uint8_t idx){
#if FLOW_TIMER3_TICK
  uint16_t nowT=TCNT3;
  uint16_t dt=(uint16_t)(nowT - lastPulseTicks[idx]);
  if(dt >= MIN_PULSE_T3_TICKS){ pulseCounts[idx]++; lastPulseTicks[idx]=nowT; }
#else
  unsigned long now=micros();
  static volatile unsigned long lastUs[NUM_FLOW_SENSORS]={0,0};
  if((unsigned long)(now - lastUs[idx]) >= MIN_PULSE_US){ pulseCounts[idx]++; lastUs[idx]=now; }
#endif
}
ISR(INT0_vect){ handleFlowPulse(0); }
ISR(INT1_vect){ handleFlowPulse(1); }
#else
void countPulse1(){ handleFlowPulse(0); }
void countPulse2(){ handleFlowPulse(1); }
#endif

// =========================== ADC 백그라운드 샘플러 ===========================
#if ADC_BG_FREERUN
static constexpr uint8_t  ADC_OSR_LOG2      = 2;
static constexpr uint8_t  ADC_OSR           = (1 << ADC_OSR_LOG2);
static constexpr uint16_t ADC_PER_CH_HZ     = 100;
static constexpr uint16_t ADC_NUM_CH        = NUM_PRESSURE_SENSORS;
static constexpr uint32_t ADC_RAW_SPS       = (uint32_t)ADC_NUM_CH * ADC_OSR * ADC_PER_CH_HZ;
static constexpr uint32_t T1CLK_HZ          = 16000000UL / 8UL;
static constexpr uint16_t T1_TOP            = (uint16_t)((T1CLK_HZ + (ADC_RAW_SPS/2)) / ADC_RAW_SPS) - 1;
volatile uint16_t adcAvg[ADC_NUM_CH] = {0,0,0,0};

volatile uint8_t  adcCh = 0;
volatile uint8_t  adcOsrCnt = 0;
volatile uint8_t  adcDiscard = 1;
volatile uint16_t adcAcc = 0;

static inline void adcSetMux(uint8_t ch){ ADMUX = _BV(REFS0) | (ch & 0x0F); }

static void adcInitFreeRun(){
  DIDR0 = _BV(ADC0D) | _BV(ADC1D) | _BV(ADC2D) | _BV(ADC3D);
  TCCR1A = 0; TCCR1B = 0; TCNT1  = 0;
  OCR1A  = T1_TOP; OCR1B  = T1_TOP;
  TCCR1B = _BV(WGM12) | _BV(CS11);
  adcSetMux(0);
  ADCSRA = _BV(ADEN) | _BV(ADIE) | _BV(ADATE) | _BV(ADPS2) | _BV(ADPS1);
  ADCSRB = (ADCSRB & ~0x07) | _BV(ADTS2) | _BV(ADTS0);
  ADCSRA |= _BV(ADSC);
}

ISR(ADC_vect){
  uint16_t v = ADC;
  if(adcDiscard){ adcDiscard = 0; return; }
  adcAcc += v;
  if(++adcOsrCnt >= ADC_OSR){
    adcAvg[adcCh] = (adcAcc + (1U << (ADC_OSR_LOG2-1))) >> ADC_OSR_LOG2;
    adcAcc = 0;
    adcOsrCnt = 0;
    adcCh = (adcCh + 1) % ADC_NUM_CH;
    adcSetMux(adcCh);
    adcDiscard = 1;
  }
}
static inline uint16_t adcReadAvg(uint8_t ch){
  uint16_t v; uint8_t s=SREG; cli(); v=adcAvg[ch]; SREG=s; return v;
}
#endif

// =========================== 공용 유틸/안전 ===========================
static inline void uppercaseInPlace(char* s){ for(; *s; ++s){ if(*s>='a' && *s<='z') *s = char(*s - ('a'-'A')); } }
static inline void sendAck(uint32_t msgId){ Serial.print(F("ACK,")); Serial.println(msgId); }
static inline void sendNack(uint32_t msgId, const __FlashStringHelper* reason){ Serial.print(F("NACK,")); Serial.print(msgId); Serial.print(F(",")); Serial.println(reason); }

// --- 이동 로직: 일반/강제 공통 구현 ---
static bool startValveMoveImpl(uint8_t idx, bool open, bool force){
  if (idx >= NUM_SERVOS) return false;
  if (!force && servoStates[idx] != IDLE) return false;
  servos[idx].attach(servoPins[idx], 500, 2500);
  targetAngles[idx] = open ? initialOpenAngles[idx] : initialClosedAngles[idx];
  servos[idx].write(targetAngles[idx]);
  servoStates[idx] = MOVING;
  servoDir[idx] = open ? -1 : +1;
  lastMoveTime[idx] = millis();
  return true;
}
static bool startValveMove(uint8_t idx, bool open){ return startValveMoveImpl(idx, open, false); }
static bool startValveMoveForce(uint8_t idx, bool open){ return startValveMoveImpl(idx, open, true); }

// --- 비상 시퀀스(강제 오버라이드) ---
static void triggerEmergency(const __FlashStringHelper* reason){
  if (emergencyActive) return;
  emergencyActive = true;
  for (uint8_t i=0; i<NUM_SERVOS; i++){
    bool open = (servoRoles[i] != ROLE_MAIN); // VENT/PURGE만 OPEN, MAIN은 CLOSE
    // 진행 중 여부와 무관하게 강제 오버라이드
    servos[i].detach();
    startValveMoveForce(i, open);
  }
  Serial.print(F("EMERG,")); Serial.println(reason);
}

// =================================================================
void setup() {
  Serial.begin(SERIAL_BAUD);
  while (Serial.available()) { Serial.read(); }
  delay(50);
  Serial.println(F("BOOT"));
  delay(500);

  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    pinMode(limitSwitchPins[i][0], INPUT_PULLUP);
    pinMode(limitSwitchPins[i][1], INPUT_PULLUP);
    servos[i].detach();
    servoStates[i] = IDLE;
    targetAngles[i] = 90;
    lastMoveTime[i] = 0;
    servoDir[i] = 0;
  }

  pinMode(flowSensorPins[0], INPUT); pinMode(flowSensorPins[1], INPUT);
#if FLOW_TIMER3_TICK
  TCCR3A = 0; TCCR3B = 0; TCNT3  = 0; TCCR3B = _BV(CS31);
#endif
#if FAST_FLOW_ISR
  EICRA = (1 << ISC01) | (1 << ISC00) | (1 << ISC11) | (1 << ISC10);
  EIFR  = (1 << INTF0) | (1 << INTF1);
  EIMSK = (1 << INT0) | (1 << INT1);
#else
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[0]), countPulse1, RISING);
  attachInterrupt(digitalPinToInterrupt(flowSensorPins[1]), countPulse2, RISING);
#endif
#if ADC_BG_FREERUN
  adcInitFreeRun();
#endif

  lastFlowCalcMs = millis();
  lastHeartbeatMs = millis();
  heartbeatArmed = false;
  Serial.println(F("READY"));
}

void loop() {
  const unsigned long now = millis();
  if (heartbeatArmed && !emergencyActive && (now - lastHeartbeatMs >= HEARTBEAT_TIMEOUT_MS)) {
    triggerEmergency(F("HB_TIMEOUT"));
  }

  readSerialCommands();
  updateLimitSwitchStates();
  manageAllServoMovements(now);
  if (now - lastTempReadTime >= TEMP_READ_INTERVAL) {
    lastTempReadTime = now;
    updateTemperatureReadings();
  }
  if (now - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = now;
    readAndSendAllSensorData(now);
  }
}

// ========================= 시리얼 처리 (개선된 파서) =========================
static void processCommandFrame(char* line) {
    char* lastComma = strrchr(line, ',');
    if (!lastComma) { sendNack(0, F("FRAME_ERR")); return; }
    *lastComma = '\0';
    // CRC 분리

    char* crcHexStr = lastComma + 1;
    char* msgIdComma = strrchr(line, ',');
    if (!msgIdComma) { sendNack(0, F("FRAME_ERR")); return; }
    *msgIdComma = '\0';
    // msgId 분리

    char* msgIdStr = msgIdComma + 1;
    char* payload = line;
    // 송신측과 동일하게 "payload,msgId"로 CRC 계산
    char crcData[96];
    snprintf(crcData, sizeof(crcData), "%s,%s", payload, msgIdStr);
    uint8_t calculated_crc = crc8((const uint8_t*)crcData, strlen(crcData));
    uint8_t received_crc   = (uint8_t)strtoul(crcHexStr, NULL, 16);
    uint32_t msgId         = strtoul(msgIdStr, NULL, 10);
    if (calculated_crc != received_crc) {
        sendNack(msgId, F("CRC_FAIL"));
        // CRC 오류는 비상 아님: 상위에서 재시도
        return;
    }

    // --- Command Processing ---
    uppercaseInPlace(payload);
    if (strcmp(payload, "HB") == 0) {
        lastHeartbeatMs = millis();
        if (!heartbeatArmed) heartbeatArmed = true;
        sendAck(msgId);
        return;
    }

    if (strcmp(payload, "HELLO") == 0 || strcmp(payload, "H") == 0) {
        Serial.println(F("READY"));
        sendAck(msgId);
        return;
    }

    if (strcmp(payload, "PING") == 0) {
        Serial.println(F("PONG"));
        sendAck(msgId);
        return;
    }

    // 비상 중에는 SAFE_CLEAR만 허용
    if (emergencyActive && strcmp(payload, "SAFE_CLEAR") != 0) {
        sendNack(msgId, F("EMERG_ACTIVE"));
        return;
    }

    if (strcmp(payload, "SAFE_CLEAR") == 0) {
        emergencyActive = false;
        heartbeatArmed = false; // 재무장 위해 새 HB 요구
        lastHeartbeatMs = millis();
        sendAck(msgId);
        Serial.println(F("EMERG_CLEARED"));
        return;
    }

    // V,<idx>,O|C
    if (payload[0] == 'V' && payload[1] == ',') {
        int servoIndex = -1;
        char stateCmd = 0;
        sscanf(payload, "V,%d,%c", &servoIndex, &stateCmd);

        if (servoIndex >= 0 && servoIndex < NUM_SERVOS && (stateCmd == 'O' || stateCmd == 'C')) {
            if (startValveMove((uint8_t)servoIndex, stateCmd == 'O')) {
                sendAck(msgId);
            } else {
                sendNack(msgId, F("BUSY"));
            }
        } else {
            sendNack(msgId, F("CMD_INVALID"));
        }
        return;
    }

    sendNack(msgId, F("CMD_UNKNOWN"));
}

static void readSerialCommands() {
  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    lastByteMs = millis();
    if (ch == '\r') continue;
    if (ch == '\n' || ch == ';') { // 개행 또는 세미콜론으로 프레임 종료
      if (cmdLen > 0) { cmdBuf[cmdLen] = '\0';
      processCommandFrame(cmdBuf); }
      cmdLen = 0;
    } else if (cmdLen < sizeof(cmdBuf) - 1) {
      cmdBuf[cmdLen++] = ch;
    } else {
      cmdLen = 0;
      // overflow → drop
    }
  }
  if (cmdLen > 0 && (millis() - lastByteMs) > LINE_IDLE_COMMIT_MS) {
    cmdBuf[cmdLen] = '\0';
    processCommandFrame(cmdBuf);
    cmdLen = 0;
  }
}

// ========================= 서보 상태 머신 =========================
static inline void enterStallRelief(uint8_t i, int reliefAngle, unsigned long now){
  reliefAngle = constrain(reliefAngle, 0, 180);
  servos[i].write(reliefAngle);
  servoStates[i] = STALL_RELIEF;
  lastMoveTime[i] = now;
}
static void manageAllServoMovements(const unsigned long now) {
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    switch (servoStates[i]) {
      case MOVING:
        if ((unsigned long)(now - lastMoveTime[i]) > SERVO_SETTLE_TIME) {
          const bool isOpen  = (currentLimitSwitchStates[i][0] == 1);
          const bool isClose = (currentLimitSwitchStates[i][1] == 1);
          const bool goingOpen = (servoDir[i] < 0);
          if ((goingOpen && isOpen) || (!goingOpen && isClose)) {
            int relief = targetAngles[i] + (goingOpen ? STALL_RELIEF_ANGLE : -STALL_RELIEF_ANGLE);
            enterStallRelief(i, relief, now);
          } else {
            servoStates[i] = goingOpen ?
            INCHING_OPEN : INCHING_CLOSED;
          }
        }
        break;
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

      case IDLE: default: break;
    }
  }
}

// ========================= 스위치 스냅샷 =========================
static void updateLimitSwitchStates() {
#if FAST_LIMIT_IO
  uint8_t a = ~PINA;
  uint8_t c = ~PINC;
  for (uint8_t i = 0; i < 4; ++i) {
    uint8_t bits = (a >> (i * 2));
    currentLimitSwitchStates[i][0] = bits & 0x01;
    currentLimitSwitchStates[i][1] = (bits >> 1) & 0x01;
  }
  currentLimitSwitchStates[4][0] = (c >> 7) & 1;
  currentLimitSwitchStates[4][1] = (c >> 6) & 1;
  currentLimitSwitchStates[5][0] = (c >> 5) & 1;
  currentLimitSwitchStates[5][1] = (c >> 4) & 1;
  currentLimitSwitchStates[6][0] = (c >> 3) & 1;
  currentLimitSwitchStates[6][1] = (c >> 2) & 1;
#else
  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    currentLimitSwitchStates[i][0] = (uint8_t)!digitalRead(limitSwitchPins[i][0]);
    currentLimitSwitchStates[i][1] = (uint8_t)!digitalRead(limitSwitchPins[i][1]);
  }
#endif
}

// ========================= 센서 전송(+압력 안전체크) =========================
static void readAndSendAllSensorData(const unsigned long now) {
  const unsigned long dtMs_ul = now - lastFlowCalcMs;
  lastFlowCalcMs = now;
  const uint16_t dtMs = (dtMs_ul > 0) ? (uint16_t)min(dtMs_ul, 65535UL) : (uint16_t)SENSOR_READ_INTERVAL;
  const uint16_t aQ15 = alphaQ15_from_dt(dtMs);
  unsigned long counts[NUM_FLOW_SENSORS];
  noInterrupts();
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) { counts[i] = pulseCounts[i]; pulseCounts[i] = 0; }
  interrupts();
  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    int32_t inst_m3h_1e4 = 0;
    if (counts[i] > 0) {
      uint64_t num = (uint64_t)counts[i] * (uint64_t)FLOW_A_1e4[i];
      inst_m3h_1e4 = (int32_t)((num + (dtMs/2)) / dtMs);
    }
    int32_t err = inst_m3h_1e4 - flowRates_m3h_1e4[i];
    int32_t delta = (int32_t)(((int64_t)err * aQ15 + 16384) >> 15);
    flowRates_m3h_1e4[i] += delta;
  }

#if PACKED_SERIAL
  size_t p = 0;
#endif

  bool pressureTrip = false;
  unsigned long dtPressMs = (lastPressureCheckMs == 0) ? 0 : (now - lastPressureCheckMs);
  uint32_t psi100_now[NUM_PRESSURE_SENSORS];

  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) {
    uint16_t adc = adcReadAvg(i);
    const uint32_t psi100 = ((uint32_t)adc * PSI_PER_ADC_X1000 + 5) / 10;
    psi100_now[i] = psi100;
#if PACKED_SERIAL
    bufPutChar(p, 'p'); bufPutChar(p, 't'); bufPutUInt(p, i+1); bufPutChar(p, ':');
    bufPutFixed(p, (int32_t)psi100, 2);
    bufPutChar(p, ',');
#endif

    if (!emergencyActive) {
      if (PRESSURE_MAX_PSIx100 > 0 && psi100 >= PRESSURE_MAX_PSIx100) {
        pressureTrip = true;
      }
      if (!pressureTrip && PRESSURE_ROC_MAX_PSIx100_PER_S > 0 && dtPressMs > 0 && lastPressureCheckMs != 0) {
        int32_t dpsi = (int32_t)psi100 - (int32_t)lastPsi100[i];
        if (dpsi > 0) {
          uint32_t roc = (uint32_t)(( (uint64_t)dpsi * 1000UL + (dtPressMs/2) ) / dtPressMs);
          if (roc >= PRESSURE_ROC_MAX_PSIx100_PER_S) pressureTrip = true;
        }
      }
    }
  }
  lastPressureCheckMs = now;
  for (uint8_t i=0; i<NUM_PRESSURE_SENSORS; i++) lastPsi100[i] = psi100_now[i];

  if (pressureTrip) triggerEmergency(F("PRESSURE"));

#if PACKED_SERIAL
  bufPutStr(p, "tc1:");
  if (tempCelsius_mC_1 == INT32_MIN) bufPutStr(p, "ERR");
  else { const int32_t k100 = (tempCelsius_mC_1 + 273150) / 10; bufPutFixed(p, k100, 2);
  }
  bufPutChar(p, ',');
  bufPutStr(p, "tc2:");
  if (tempCelsius_mC_2 == INT32_MIN) bufPutStr(p, "ERR");
  else { const int32_t k100 = (tempCelsius_mC_2 + 273150) / 10; bufPutFixed(p, k100, 2);
  }

  for (uint8_t i=0; i<NUM_FLOW_SENSORS; i++) {
    bufPutStr(p, ",fm"); bufPutUInt(p, i+1); bufPutStr(p, "_m3h:");
    bufPutFixed(p, flowRates_m3h_1e4[i], 4);
    bufPutStr(p, ",fm"); bufPutUInt(p, i+1); bufPutStr(p, "_Lh:");
    bufPutFixed(p, flowRates_m3h_1e4[i], 1);
  }

  for (uint8_t i=0; i<NUM_SERVOS; i++) {
    bufPutStr(p, ",V");
    bufPutUInt(p, i); bufPutStr(p, "_LS_OPEN:");   bufPutUInt(p, currentLimitSwitchStates[i][0]);
    bufPutStr(p, ",V"); bufPutUInt(p, i); bufPutStr(p, "_LS_CLOSED:"); bufPutUInt(p, currentLimitSwitchStates[i][1]);
  }
  
  // --- 수정된 부분 (경량/안전 버전) ---
  if (p > 0 && p + 3 < OUTBUF_SZ) {
    uint8_t crc = crc8((const uint8_t*)outBuf, p);
    static const char HEX[] = "0123456789ABCDEF";
    bufPutChar(p, ',');
    bufPutChar(p, HEX[(crc >> 4) & 0x0F]);
    bufPutChar(p, HEX[crc & 0x0F]);
  }
  // --- 여기까지 ---

  bufEndlineAndSend(p);
#endif
}

// ========================= 온도 센서 읽기 =========================
static void updateTemperatureReadings() {
  static bool toggle = false;
  if (toggle) {
    float c1 = (float)thermocouple1.readCelsius();
    if (!isnan(c1)) { tempCelsius_mC_1 = (int32_t)(c1 * 1000.0f + (c1>=0 ? 0.5f : -0.5f));
    }
    else { tempCelsius_mC_1 = INT32_MIN; }
  } else {
    float c2 = (float)thermocouple2.readCelsius();
    if (!isnan(c2)) { tempCelsius_mC_2 = (int32_t)(c2 * 1000.0f + (c2>=0 ? 0.5f : -0.5f));
    }
    else { tempCelsius_mC_2 = INT32_MIN; }
  }
  toggle = !toggle;
}
