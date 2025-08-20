# GoRocket 제어 시스템 GUI

**액체로켓 엔진 지상시험 제어 및 모니터링 시스템**

Next.js + Electron 기반으로 구축된 안전한 로켓 엔진 테스트용 전문 제어 시스템입니다. 항공우주급 안전 표준과 현대적 웹 기술을 결합하여 실시간 센서 모니터링, 정밀한 밸브 제어, 자동화된 시퀀스 실행을 제공합니다.

[![Version](https://img.shields.io/badge/Version-v2.6.0-blue)](https://github.com/jungho1902/Gorocket-Control-System-GUI)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-37.2.3-blue)](https://electronjs.org/)

---

## 목차

1. [시스템 개요](#시스템-개요)
2. [핵심 기능](#핵심-기능)
3. [통신 프로토콜](#통신-프로토콜)
4. [설치 및 실행](#설치-및-실행)
5. [하드웨어 연결](#하드웨어-연결)
6. [사용자 인터페이스](#사용자-인터페이스)
7. [시퀀스 자동화](#시퀀스-자동화)
8. [안전 시스템](#안전-시스템)
9. [설정 관리](#설정-관리)
10. [데이터 로깅](#데이터-로깅)
11. [문제해결](#문제해결)
12. [시스템 사양](#시스템-사양)

---

## 시스템 개요

### 미션 크리티컬 로켓 테스트 플랫폼

이 시스템은 **액체로켓 엔진의 안전한 지상 테스트**를 위해 설계된 종합적인 제어 플랫폼입니다. 

**주요 특징:**
- 8채널 실시간 센서 모니터링 (압력 4채널, 온도 2채널, 유량 2채널)
- 7개 서보밸브 정밀 제어 (리미트 스위치 피드백 포함)
- Fill & Fire 자동화 시퀀스 실행 (Pre-Test → Hot-Fire → Safing)
- 다층 안전 보호 시스템 (850/1000 PSI 이중 임계값)
- CRC-8 기반 데이터 무결성 검증
- 전문적 데이터 로깅 및 세션 관리

### 성능 지표

| 항목 | 사양 | 설명 |
|------|------|------|
| 센서 업데이트 | 100ms | 모든 센서 실시간 갱신 |
| 비상정지 응답 | < 400ms | Emergency Shutdown 활성화 |
| 통신 속도 | 115200 baud | Arduino MCU와 USB 시리얼 |
| 압력 센서 | 4채널 | PT1-PT4 (0-1000 PSI) |
| 온도 센서 | 2채널 | TC1-TC2 (K형 열전대) |
| 유량 센서 | 2채널 | Flow1-Flow2 (펄스 기반) |
| 서보 밸브 | 7개 | SV0-SV6 (위치 피드백) |

---

## 핵심 기능

### 실시간 모니터링 및 제어

**센서 시스템**
- **압력 센서 (PT1-PT4)**: 0-1000 PSI 범위, PSI×100 정수값으로 전송
- **온도 센서 (TC1-TC2)**: K형 열전대 MAX6675, 켈빈×100으로 전송 후 섭씨 변환
- **유량 센서 (Flow1-Flow2)**: 펄스 기반 측정, L/h 및 m³/h 단위 제공
- **서보 밸브 (SV0-SV6)**: PWM 제어 + 이중 리미트 스위치 피드백

**실시간 데이터 처리**
- 백그라운드 ADC 샘플링으로 100Hz 센서 데이터 수집
- CRC-8 무결성 검증을 통한 데이터 신뢰성 보장
- 압력 변화율 모니터링 (50 PSI/s 임계값)
- 하트비트 감시를 통한 통신 상태 추적

### 안전 시스템

**3층 안전 보호 체계**

| 레벨 | 임계값 | 응답시간 | 동작 | 구현 |
|------|--------|----------|------|------|
| **소프트웨어 알람** | 850 PSI | < 300ms | Emergency Shutdown 시퀀스 | React/Electron |
| **하드웨어 트립** | 1000 PSI | 즉시 | MCU 강제 비상상태 | Arduino 펌웨어 |
| **압력 변화율** | 50 PSI/s | 연속 | 자동 비상 대응 | 소프트웨어 |
| **통신 감시** | 3초 | 자동 | 하트비트 타임아웃 보호 | MCU 타이머 |

**Emergency Shutdown 동작**
```
즉시 실행 (지연 0ms):
1. 메인 공급 차단: Ethanol Main Supply, N2O Main Supply → CLOSE
2. 가압 차단: Main Pressurization, Ethanol Fill Line → CLOSE  
3. 안전 배출: System Vent 1, System Vent 2 → OPEN
4. 화재 방지: Ethanol Purge Line → OPEN (연료 잔류물 제거)
```

### 자동화 시퀀스

**Fill & Fire 운영 시퀀스**

| 단계 | 시퀀스명 | 소요시간 | 주요 동작 |
|------|----------|----------|----------|
| **1단계** | Pre-Test Nitrogen Purge | ~25초 | N2로 전체 시스템 퍼지 |
| **2단계** | 추진제 충전 (수동) | 가변 | 에탄올 250mL, N2O 0.4kg |
| **3단계** | System Pressurization | 가변 | 600 PSI까지 가압 |
| **4단계** | Hot-Fire Sequence | ~2.3초 | 연료 선공급 → 점화 → 연소 |
| **5-6단계** | Post-Test Safing | 가변 | 라인 퍼지 및 감압 |

---

## 통신 프로토콜

### USB 시리얼 통신 (115200 baud)

**프로토콜 구조**
```
PC → Arduino: "PAYLOAD,MSG_ID,CRC"
Arduino → PC: "ACK,MSG_ID" 또는 "NACK,MSG_ID,REASON"
```

**CRC-8 무결성 검증**
- 다항식: 0x07
- 초기값: 0x00
- 양방향 CRC 검증으로 데이터 무결성 보장
- 불일치 시 NACK 응답 및 재전송

### 명령 프로토콜

**밸브 제어 명령**
```
V,INDEX,ACTION → Arduino로 전송
- INDEX: 0-6 (서보 인덱스)
- ACTION: O (Open) 또는 C (Close)
- 예시: "V,0,O,12345,A7" (SV0 열기, MSG_ID=12345, CRC=A7)

명령 처리 과정:
1. GUI에서 "CMD,Ethanol Purge Line,Open" 시퀀스 명령
2. cmdTransform.ts에서 valveMapping 조회하여 "V,0,O"로 변환
3. SerialManager에서 MSG_ID 생성하여 "V,0,O,12345,XX" 완성
4. CRC-8 계산하여 최종 "V,0,O,12345,A7" 패킷 생성
5. Arduino에서 CRC 검증 후 서보 PWM 신호 출력
6. 리미트 스위치 피드백으로 실제 위치 확인
7. "ACK,12345" 또는 "NACK,12345,REASON" 응답
```

**하트비트 명령**
```
HB → 3초마다 전송
- MCU 타임아웃 방지
- 통신 상태 확인
- 비상시 자동 Emergency 트리거

하트비트 시스템 동작:
1. SerialManager에서 2.8초마다 "HB,MSG_ID,CRC" 자동 전송
2. Arduino에서 수신 시 lastHeartbeatMs 타임스탬프 갱신
3. 3초 이상 미수신 시 Arduino가 "EMERG,HB_TIMEOUT" 발생
4. PC 소프트웨어 크래시나 USB 연결 끊김 감지 가능
5. 무인 운영 중 통신 장애 시 자동 안전모드 진입
6. Emergency 발생 시까지 모든 제어 명령 정상 처리
```

**시스템 명령**
```
HELLO → 연결 확인
PING → 응답성 테스트 (PONG 응답)
SAFE_CLEAR → 비상상태 해제

시스템 명령 상세:
1. HELLO: 초기 연결 시 Arduino 상태 확인
   - Arduino 응답: "READY" + "ACK,MSG_ID"
   - 연결 성공 시 GUI 헤더에 "Connected" 표시

2. PING: 통신 지연시간 측정 및 응답성 테스트
   - Arduino 응답: "PONG" + "ACK,MSG_ID"
   - Round-trip time 측정으로 통신 품질 확인

3. SAFE_CLEAR: Emergency 상태에서 정상 모드로 복귀
   - emergencyActive = false, heartbeatArmed = false 리셋
   - Arduino 응답: "EMERG_CLEARED" + "ACK,MSG_ID"
   - GUI에서 3초 홀드 버튼으로만 실행 가능 (오조작 방지)
```

### 센서 데이터 패킷

**Arduino → PC 텔레메트리 패킷**
```
pt1:15000,pt2:12500,pt3:8900,pt4:7600,tc1:29315,tc2:29820,
fm1_m3h:125,fm1_Lh:1250,fm2_m3h:98,fm2_Lh:980,
V0_LS_OPEN:0,V0_LS_CLOSED:1,V1_LS_OPEN:0,V1_LS_CLOSED:1,
...(V6까지 반복)...,3A

데이터 해석 및 변환 과정:
- pt1: 15000 → 150.00 PSI (ADC 값 ÷ 100)
  * ADC 0-1023 → 0-1000 PSI 선형 변환
  * 정밀도: 0.01 PSI (소수점 2자리)
  
- tc1: 29315 → 20.0°C ((29315/100) - 273.15)
  * MAX6675에서 켈빈×100 형태로 전송
  * GUI에서 섭씨 온도로 자동 변환 표시
  
- fm1_Lh: 1250 → 125.0 L/h (값 ÷ 10)
  * 펄스 카운터 기반 유량 측정
  * m³/h와 L/h 단위 동시 제공
  
- V0_LS_CLOSED:1 → SV0이 CLOSED 위치의 리미트 스위치 활성화
  * 물리적 피드백으로 실제 밸브 위치 확인
  * lsOpen=0, lsClosed=1이면 완전히 닫힌 상태
  
- 마지막 3A: CRC-8 체크섬 (16진수)
  * 전체 데이터 문자열의 CRC-8 계산값
  * 불일치 시 "Telemetry integrity error" 발생
  * sensorParser.ts에서 룩업 테이블로 고속 검증
```

### ACK/NACK 응답 시스템

**성공 응답 (ACK)**
```
Arduino → PC: "ACK,12345"
- MSG_ID 12345 명령 성공적으로 실행

ACK 응답 처리:
1. Arduino에서 명령 수신 및 CRC 검증 성공
2. 명령 파싱 및 유효성 검사 통과
3. 서보 또는 시스템 동작 실행 완료
4. "ACK,MSG_ID" 응답 전송 (CRC 없는 시스템 메시지)
5. GUI에서 ACK 수신로 명령 실행 성공 확인
6. Promise resolve로 비동기 체인 계속 진행
```

**실패 응답 (NACK)**
```
Arduino → PC: "NACK,12345,BUSY"
- MSG_ID 12345 실행 실패
- REASON 코드 상세 설명:

  * BUSY: 서보 이미 동작 중
    - 이전 명령의 서보 이동이 아직 진행 중
    - 리미트 스위치 피드백 대기 중이거나 스톨 릴리프 중
    - 몇 초 후 재시도 필요

  * EMERG_ACTIVE: 비상상태에서 제어 거부
    - emergencyActive=true 상태에서 모든 밸브 명령 차단
    - SAFE_CLEAR 명령으로 Emergency 해제 후 재시도

  * CRC_FAIL: 체크섬 오류
    - 수신된 데이터의 CRC-8이 계산값과 불일치
    - 노이즈나 데이터 손상으로 인한 무결성 오류
    - SerialManager에서 자동 재전송 처리

  * CMD_INVALID: 잘못된 명령
    - 지원하지 않는 명령어나 잘못된 파라미터
    - 예: "V,7,O" (servoIndex 7은 존재하지 않음)

  * FRAME_ERR: 프레임 구조 오류
    - 예상된 "PAYLOAD,MSG_ID,CRC" 형식이 아닌 데이터
    - 콤마 누락이나 비정상적인 문자열 수신
```

### 비상 상태 알림

**비상 트리거**
```
Arduino → PC: "EMERG,PRESSURE" 
- 압력 1000 PSI 초과 시
Arduino → PC: "EMERG,HB_TIMEOUT"
- 하트비트 3초 타임아웃 시

비상 트리거 상세 시나리오:

1. EMERG,PRESSURE (압력 초과):
   - ADC 비배그라운드 샘플링에서 PT1-PT4 중 하나라도 1000 PSI 초과 감지
   - 또는 50 PSI/s 상승률 초과 감지 시
   - triggerEmergency(F("PRESSURE")) 호출
   - 즉시 모든 공급 밸브 CLOSE, 벤트 밸브 OPEN 강제 실행

2. EMERG,HB_TIMEOUT (하트빔트 타임아웃):
   - lastHeartbeatMs에서 3000ms(3초) 초과 시 발생
   - PC 소프트웨어 크래시, USB 연결 끊김, 또는 시스템 과부하로 판단
   - triggerEmergency(F("HB_TIMEOUT")) 호출
   - 동일한 Emergency Shutdown 시퀀스 실행

3. 공통 Emergency 동작:
   - emergencyActive = true 설정
   - 모든 서보 기존 동작 중단 (detach)
   - 서보 역할에 따른 안전 위치로 강제 이동
   - 이후 SAFE_CLEAR 명령 외에 모든 제어 명령 거부
```

**비상 해제**
```
Arduino → PC: "EMERG_CLEARED"
- SAFE_CLEAR 명령 수신 후
- 시스템 재-ARM 가능 상태

Emergency 해제 절차:
1. 물리적 안전 확인:
   - 모든 압력이 안전 수준 (< 50 PSI) 도달 확인
   - 서보 밸브들이 안전 위치에 있는지 육안 확인
   - 비상 원인 제거 완료 (예: 센서 교정, USB 재연결)

2. GUI에서 Safety Clear 실행:
   - Header의 "Safety Clear" 버튼을 3초간 홀드
   - 오조작 방지를 위한 장시간 누르기 필요
   - main.ts에서 safety-clear IPC 통해 SAFE_CLEAR 명령 전송

3. Arduino에서 비상 상태 리셋:
   - emergencyActive = false
   - heartbeatArmed = false (새로운 하트빔트 필요)
   - "EMERG_CLEARED" + "ACK,MSG_ID" 응답

4. GUI에서 시스템 재-ARM:
   - "System ARM" 버튼 클릭으로 수동 재무장
   - requiresArm = false 설정으로 제어 명령 활성화
   - 이후 정상 운영 진행 가능
```

---

## 설치 및 실행

### 시스템 요구사항
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB 이상 (8GB 권장)
- **저장공간**: 5GB 이상
- **USB**: Arduino 연결용 포트
- **Node.js**: 18.x 이상

### 설치 과정

```bash
# 저장소 클론
git clone https://github.com/jungho1902/Gorocket-Control-System-GUI.git
cd Gorocket-Control-System-GUI

# 의존성 설치 - Next.js, Electron, TypeScript, SerialPort 등 설치
npm install

# 네이티브 모듈 빌드 (serialport) - USB 통신을 위한 없이류리 라이브러리
npm run rebuild

# 개발 서버 실행 (localhost:9002) - Next.js 개발서버 + Electron 동시 시작
npm run dev

설치 과정 설명:
1. git clone: GitHub에서 소스 코드 다운로드
2. npm install: package.json의 모든 의존성 라이브러리 설치
3. npm run rebuild: electron-rebuild로 네이티브 모듈 재컴파일
   - serialport 모듈이 현재 Electron 버전과 일치하도록 빌드
4. npm run dev: 개발 모드에서 GUI 애플리케이션 실행
   - Next.js 개발서버가 localhost:9002에서 시작
   - Electron 메인 프로세스가 자동으로 데스크톱 앱 실행
```

### 빌드 및 배포

```bash
# TypeScript 타입 검사 - tsc --noEmit으로 컴파일 없이 타입 오류만 검사
npm run typecheck

# ESLint 코드 품질 검사 - 코딩 스타일, 잘못된 패턴, 보안 이슈 검사
npm run lint

# Jest 테스트 실행 - 단위 테스트, ConfigManager/SerialManager/CRC 테스트
npm run test

# 프로덕션 빌드 - Next.js 정적 빌드 후 Electron 앱 패키징
npm run build

# 실행 파일 생성 - Windows .exe, Linux .AppImage, macOS .dmg 생성
npm run package

빌드 과정 상세:
1. typecheck: 모든 .ts/.tsx 파일의 타입 안전성 확인
2. lint: Airbnb 규칙 기반 코드 품질 검사
3. test: __tests__ 디렉터리의 모든 테스트 실행
4. build: .next/static 및 dist/ 디렉터리에 최적화된 번들 생성
5. package: electron-builder로 OS별 설치 가능한 실행파일 생성
```

### 시퀀스 검증

```bash
# sequences.json 형식 검증 - AJV JSON Schema 검사로 시퀀스 구문 확인
npm run validate:seq

# 실행 결과 예시:
# AJV_OK true  (성공 - 모든 시퀀스가 올바른 형식)
# 또는 검증 오류 메시지 출력:
# "Error: data/Pre-Test Nitrogen Purge/3 must have required property 'commands'"
# "Error: data/Hot-Fire Sequence/2/delay must be number"

검증 항목:
1. 시퀀스명이 문자열인지 확인
2. 각 step이 message, delay, commands 필드를 갖는지 확인
3. delay가 숫자(ms)인지 확인
4. commands가 문자열 배열인지 확인
5. condition 객체의 sensor, op, timeoutMs 필드 확인
6. 지원하지 않는 여분 필드 감지
```

---

## 하드웨어 연결

### 필요 장비
- **Arduino Mega 2560** (필수)
- **USB A-B 케이블** (고품질 권장)
- **외부 전원 공급장치** (7-12V DC, 2A 이상)
- **서보 전용 전원** (6V, 10A 용량)

### Arduino 핀 배치

```
서보 제어 (PWM):
  SV0: 핀 13  SV1: 핀 12  SV2: 핀 11  SV3: 핀 10
  SV4: 핀 9   SV5: 핀 8   SV6: 핀 7

리미트 스위치 (디지털 입력, 풀업):
  핀 22-35 (각 밸브당 OPEN/CLOSED 스위치 쌍)

압력 센서 (아날로그 입력):
  PT1: A0  PT2: A1  PT3: A2  PT4: A3

유량 센서 (인터럽트 입력):
  Flow1: 핀 2 (INT0)  Flow2: 핀 3 (INT1)

온도 센서 (SPI):
  TC1: 핀 50-53 (MAX6675 #1)
  TC2: 핀 50-53 (MAX6675 #2)
```

### 연결 절차

1. **펌웨어 업로드**
   ```
   Arduino IDE에서 arduino_mega_code.ino를 Mega 2560에 업로드
   - Board: Arduino Mega 2560
   - Port: COM 포트 선택
   - Upload Speed: 115200
   ```

2. **물리적 연결**
   - USB 케이블로 Arduino와 PC 연결
   - 외부 전원 공급 (서보 작동용)
   - 센서 및 밸브 배선 확인
   - 접지 연결 확인 (노이즈 방지)

3. **소프트웨어 연결**
   - GUI 실행 후 Header에서 COM 포트 선택
   - "Connect" 버튼 클릭
   - "Connected" 상태 및 센서 데이터 수신 확인

### 초기 동작 확인

**Arduino 부팅 시퀀스**
```
Serial Output:
BOOT
READY

예상되는 응답:
- BOOT: 하드웨어 초기화 완료
- READY: 명령 수신 준비 완료
```

**GUI 연결 테스트**
```
GUI → Arduino: "HELLO,1,XX"
Arduino → GUI: "READY"
Arduino → GUI: "ACK,1"

→ 연결 성공 시 헤더에 "Connected" 표시
```

---

## 사용자 인터페이스

### 대시보드 구성

**Header Panel**
- **COM 포트 선택**: 드롭다운에서 Arduino 포트 선택
- **연결 제어**: Connect/Disconnect 버튼
- **Emergency Stop**: 즉시 비상정지 (빨간 버튼)
- **Safety Clear**: 3초 홀드로 비상상태 해제
- **시스템 상태**: Connected/Emergency/Armed 표시
- **압력 한계**: ALARM (850 PSI) / TRIP (1000 PSI) 표시

**Sensor Panel** 
- **압력 표시**: PT1-PT4 (PSI 단위, 색상 코딩)
  - 녹색: 정상 (< 800 PSI)
  - 주황: 경고 (800-850 PSI)  
  - 빨간: 알람 (> 850 PSI)
- **온도 표시**: TC1-TC2 (°C 단위, K×100 → °C 변환)
- **유량 표시**: Flow1-Flow2 (L/h 단위)
- **업데이트 주기**: 0.1초마다 실시간 갱신

**Valve Control Panel**
- **7개 밸브 제어**: SV0-SV6 개별 Open/Close 버튼
- **현재 상태**: OPEN/CLOSED/UNKNOWN 표시
- **리미트 스위치**: lsOpen/lsClosed 상태 표시
- **안전 잠금**: 비상시 모든 제어 비활성화
- **서보 피드백**: 2초 타임아웃 내 위치 확인 필수

**Sequence Panel**
- **시퀀스 선택**: 드롭다운에서 사용 가능한 시퀀스 선택
  - Pre-Test Nitrogen Purge
  - System Pressurization (600 psi)
  - Hot-Fire Sequence
  - Post-Test Safing
  - Emergency Shutdown
  - Random Test (6 valves, 7 valves)
  - Pre-Operation Safe Init
- **실행 제어**: Start/Cancel 버튼
- **진행 상태**: 현재 단계 및 남은 시간 표시
- **안전 확인**: sequences.json 검증 완료 후에만 활성화

**Data Chart Panel**
- **실시간 그래프**: 8개 센서 동시 표시
- **시간 축**: 최근 100포인트 (10초간) 히스토리
- **자동 스케일링**: Y축 최대/최소값 자동 조정
- **마우스 상호작용**: 휠 줌, 드래그 팬
- **범례 토글**: 센서별 표시/숨김 가능

**Terminal Panel**
- **시스템 로그**: 모든 시리얼 통신 실시간 표시
- **시퀀스 진행**: 각 단계 실행 상태 메시지
- **오류 추적**: NACK, 타임아웃, CRC 오류 등 상세 표시
- **500라인 버퍼**: 자동 스크롤, 검색 기능
- **로그 필터링**: ACK/NACK 라인 자동 구분 표시

### 키보드 단축키 및 접근성
- `Ctrl + =`: 인터페이스 확대
- `Ctrl + -`: 인터페이스 축소  
- `Ctrl + 0`: 기본 크기로 리셋
- `Ctrl + 마우스휠`: 줌 조절
- **고대비 모드**: 중요 상태 향상된 가시성
- **터치 친화적**: 산업용 터치스크린 대응

---

## 시퀀스 자동화

### 전체 운영 시퀀스 상세 분석

#### 1단계: Pre-Test Nitrogen Purge (25초)

**목적**: 시스템 전체를 N2로 퍼지하여 공기, 수분, 오염물질 제거

**sequences.json 정의**:
```json
"Pre-Test Nitrogen Purge": [
  {
    "message": "Set PR1 to 5 psig low pressure",
    "delay": 0,
    "commands": []
  },
  {
    "message": "Open main pressurization for N2 purge", 
    "delay": 0,
    "commands": ["CMD,Main Pressurization,Open"]
  },
  {
    "message": "Open purge line for N2 flow",
    "delay": 0, 
    "commands": ["CMD,Ethanol Purge Line,Open"]
  },
  {
    "message": "Open ethanol fill line for purge",
    "delay": 100,
    "commands": ["CMD,Ethanol Fill Line,Open"]
  },
  {
    "message": "Open vent valves for purge exit",
    "delay": 100,
    "commands": [
      "CMD,System Vent 1,Open",
      "CMD,System Vent 2,Open"  
    ]
  },
  {
    "message": "N2 purge for 20+ seconds",
    "delay": 20000,
    "commands": []
  },
  {
    "message": "Close all valves to seal system",
    "delay": 0,
    "commands": [
      "CMD,Main Pressurization,Close",
      "CMD,Ethanol Fill Line,Close", 
      "CMD,Ethanol Purge Line,Close",
      "CMD,System Vent 1,Close",
      "CMD,System Vent 2,Close"
    ]
  }
]
```

**실제 패킷 흐름**:
```
GUI → SequenceEngine: Start "Pre-Test Nitrogen Purge"
SequenceEngine → cmdTransform: "CMD,Main Pressurization,Open"
cmdTransform → SerialManager: "V,1,O" (servoIndex=1)
SerialManager → Arduino: "V,1,O,12001,A5"
Arduino → SerialManager: "ACK,12001"
[100ms delay]
SequenceEngine → SerialManager: "V,0,O,12002,B3" (Ethanol Purge Line)
... (각 명령마다 ACK 확인)
[20000ms N2 purge delay]
SequenceEngine → SerialManager: [모든 밸브 Close 명령들]
```

#### 2단계: 추진제 충전 (수동 작업)

**수행 내용**:
- 에탄올 충전: 딥 튜브와 니들 밸브를 통해 250mL
- N2O 충전: 공급 매니폴드를 통해 600 PSI로 0.4kg
- 로드셀을 통한 정량 확인

**시스템 상태**: 모든 밸브 닫힌 상태 유지, GUI는 센서 모니터링만 수행

#### 3단계: System Pressurization (600 psi)

**조건부 대기 시퀀스**:
```json
"System Pressurization (600 psi)": [
  {
    "message": "Set PR1 to 600 psi final pressure", 
    "delay": 0,
    "commands": []
  },
  {
    "message": "Open main pressurization line",
    "delay": 0,
    "commands": ["CMD,Main Pressurization,Open"]
  },
  {
    "message": "Wait for PT1 to reach 600 psi",
    "delay": 0,
    "commands": [],
    "condition": { 
      "sensor": "pt1", 
      "min": 580, 
      "op": "gte", 
      "timeoutMs": 120000 
    }
  },
  {
    "message": "System pressurized - ready for hot-fire",
    "delay": 2000,
    "commands": []
  }
]
```

**조건 대기 구현 (SequenceEngine.ts)**:
```typescript
private async executeConditionStep(step: any) {
  const { condition, timeoutMs } = step;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const sensorValue = this.getSensorValue(condition.sensor);
    if (this.checkCondition(sensorValue, condition)) {
      return; // 조건 만족, 다음 단계로
    }
    await sleep(condition.pollMs || 50);
  }
  throw new Error(`조건 대기 타임아웃: ${condition.sensor} ${condition.op} ${condition.min}`);
}
```

#### 4단계: Hot-Fire Sequence (2.3초 정밀 타이밍)

**중요 타이밍 시퀀스**:
```json
"Hot-Fire Sequence": [
  {
    "message": "Ensure oxidizer line closed",
    "delay": 0,
    "commands": ["CMD,N2O Main Supply,Close"]
  },
  {
    "message": "Fuel lead - Open ethanol supply first", 
    "delay": 0,
    "commands": ["CMD,Ethanol Main Supply,Open"]
  },
  {
    "message": "Fuel lead time (0.1-0.2s)",
    "delay": 150,
    "commands": []
  },
  {
    "message": "Ignition - Open N2O supply",
    "delay": 0, 
    "commands": ["CMD,N2O Main Supply,Open"]
  },
  {
    "message": "Main burn phase (2+ seconds)",
    "delay": 2000,
    "commands": []
  },
  {
    "message": "Shutdown - Close oxidizer first",
    "delay": 0,
    "commands": ["CMD,N2O Main Supply,Close"]
  },
  {
    "message": "Delay before closing fuel", 
    "delay": 100,
    "commands": []
  },
  {
    "message": "Close fuel supply",
    "delay": 0,
    "commands": ["CMD,Ethanol Main Supply,Close"]
  }
]
```

**타이밍 다이어그램**:
```
Time:  0ms    150ms   2150ms  2250ms
       |       |        |       |
SV4:   OPEN----+--------+OPEN---+CLOSE (Ethanol Main Supply)
SV3:   CLOSE---+OPEN----+-------+CLOSE (N2O Main Supply)
Phase: Fuel    Ignition  Burn    Shutdown
       Lead    
```

#### 5-6단계: Post-Test Safing

**안전한 시스템 종료**:
```json
"Post-Test Safing": [
  {
    "message": "Immediate line purge - Open ethanol purge",
    "delay": 0,
    "commands": ["CMD,Ethanol Purge Line,Open"]
  },
  {
    "message": "Purge engine lines with N2", 
    "delay": 3000,
    "commands": []
  },
  {
    "message": "Open vent valves for pressure relief",
    "delay": 0,
    "commands": [
      "CMD,System Vent 1,Open",
      "CMD,System Vent 2,Open"
    ]
  },
  {
    "message": "Wait for complete pressure relief (pt1 <= 15 psi)",
    "delay": 0,
    "commands": [],
    "condition": { 
      "sensor": "pt1", 
      "max": 15, 
      "op": "lte", 
      "timeoutMs": 60000 
    }
  },
  {
    "message": "Wait for complete pressure relief (pt2 <= 15 psi)",
    "delay": 0, 
    "commands": [],
    "condition": { 
      "sensor": "pt2", 
      "max": 15, 
      "op": "lte", 
      "timeoutMs": 60000 
    }
  }
]
```

### 테스트 시퀀스

**Random Test (6 valves)**:
```json
"Random Test (6 valves, no #7)": [
  { "message": "V0 Open", "delay": 0, "commands": ["V,0,O"] },
  { "message": "V1 Open", "delay": 800, "commands": ["V,1,O"] },
  { "message": "V0 Close", "delay": 700, "commands": ["V,0,C"] },
  // ... 12단계 랜덤 테스트
]
```

**Pre-Operation Safe Init**:
```json
"Pre-Operation Safe Init": [
  {
    "message": "Ensure all valves closed (baseline safe state)",
    "delay": 0,
    "commands": [
      "CMD,Ethanol Main Supply,Close",
      "CMD,N2O Main Supply,Close", 
      "CMD,Ethanol Purge Line,Close",
      "CMD,Ethanol Fill Line,Close",
      "CMD,Main Pressurization,Close",
      "CMD,System Vent 1,Close",
      "CMD,System Vent 2,Close"
    ]
  }
]
```

### 시퀀스 실행 엔진 (SequenceEngine.ts)

**주요 메서드**:
```typescript
async start(sequenceName: string) {
  const sequence = this.dataManager.getSequences()[sequenceName];
  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i];
    this.emit('progress', { name: sequenceName, stepIndex: i, step });
    
    if (step.commands && step.commands.length > 0) {
      await this.executeCommands(step.commands);
    }
    
    if (step.condition) {
      await this.executeConditionStep(step);
    }
    
    if (step.delay > 0) {
      await sleep(step.delay);
    }
  }
  this.emit('complete', { name: sequenceName });
}
```

---

## 안전 시스템

### 다층 안전 보호 상세 분석

#### Level 1: 소프트웨어 모니터링 (React/Electron)

**압력 모니터링 (useSensorData.ts)**:
```typescript
useEffect(() => {
  const checkPressureAlarm = (data: SensorData) => {
    if (exceedsPressureLimit(data, PRESSURE_LIMIT_ALARM)) {
      consecutiveAlarms++;
      if (consecutiveAlarms >= 3) {
        // 3회 연속 임계값 초과 → 비상정지
        window.electronAPI.safeTrigger('UI_PRESSURE_EXCEEDED');
      }
    } else {
      consecutiveAlarms = 0;
    }
  };
}, [sensorData]);
```

**압력 변화율 감지**:
```typescript
const pressureRateCheck = () => {
  const currentTime = Date.now();
  const timeDelta = (currentTime - lastPressureTime) / 1000; // 초 단위
  
  for (const sensor of ['pt1', 'pt2', 'pt3', 'pt4']) {
    const currentPressure = sensorData[sensor];
    const lastPressure = previousPressure[sensor];
    const rateOfChange = (currentPressure - lastPressure) / timeDelta;
    
    if (rateOfChange > PRESSURE_RATE_LIMIT) {
      window.electronAPI.safeTrigger('PRESSURE_RATE_EXCEEDED');
    }
  }
};
```

#### Level 2: 하드웨어 보호 (Arduino MCU)

**압력 트립 검사 (arduino_mega_code.ino)**:
```cpp
static void checkPressureSafety(unsigned long now) {
  bool pressureTrip = false;
  uint32_t psi100_now[NUM_PRESSURE_SENSORS];
  
  // ADC 백그라운드 샘플러에서 압력값 읽기
  for (uint8_t i = 0; i < NUM_PRESSURE_SENSORS; i++) {
    uint16_t adcVal = adcReadAvg(i);
    psi100_now[i] = (uint32_t)((adcVal * 100000UL) / 1023UL);
    
    // 1000 PSI 하드웨어 트립 검사
    if (psi100_now[i] >= PRESSURE_TRIP_PSIx100) {
      pressureTrip = true;
    }
  }
  
  // 압력 상승률 검사 (50 PSI/s)
  if (now - lastPressureCheckMs >= 1000UL) {
    for (uint8_t i = 0; i < NUM_PRESSURE_SENSORS; i++) {
      uint32_t delta = (psi100_now[i] > lastPsi100[i]) ? 
                       (psi100_now[i] - lastPsi100[i]) : 0;
      if (delta >= PRESSURE_ROC_MAX_PSIx100_PER_S) {
        pressureTrip = true;
      }
    }
    lastPressureCheckMs = now;
    for (uint8_t i = 0; i < NUM_PRESSURE_SENSORS; i++) {
      lastPsi100[i] = psi100_now[i];
    }
  }
  
  if (pressureTrip) {
    triggerEmergency(F("PRESSURE"));
  }
}
```

**하트비트 감시**:
```cpp
void loop() {
  const unsigned long now = millis();
  
  // 하트비트 타임아웃 검사 (3초)
  if (heartbeatArmed && !emergencyActive && 
      (now - lastHeartbeatMs >= HEARTBEAT_TIMEOUT_MS)) {
    triggerEmergency(F("HB_TIMEOUT"));
  }
  
  // 다른 루프 작업...
}
```

#### Level 3: 물리적 안전장치

**리미트 스위치 모니터링**:
```cpp
static void updateLimitSwitchStates() {
  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    // 풀업 저항 사용, LOW = 활성화
    bool openLS = !digitalRead(limitSwitchPins[i][0]);
    bool closedLS = !digitalRead(limitSwitchPins[i][1]);
    
    currentLimitSwitchStates[i][0] = openLS;
    currentLimitSwitchStates[i][1] = closedLS;
  }
}
```

**서보 상태 머신**:
```cpp
enum ServoState { IDLE, MOVING, INCHING_OPEN, INCHING_CLOSED, STALL_RELIEF };

static void manageAllServoMovements(unsigned long now) {
  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    switch (servoStates[i]) {
      case MOVING:
        if ((now - lastMoveTime[i]) > SERVO_SETTLE_TIME) {
          bool isOpen = currentLimitSwitchStates[i][0];
          bool isClose = currentLimitSwitchStates[i][1]; 
          bool goingOpen = (servoDir[i] < 0);
          
          if ((goingOpen && isOpen) || (!goingOpen && isClose)) {
            // 목표 위치 도달 → 스톨 릴리프
            int relief = targetAngles[i] + (goingOpen ? STALL_RELIEF_ANGLE : -STALL_RELIEF_ANGLE);
            enterStallRelief(i, relief, now);
          } else {
            // 아직 도달하지 못함 → 인칭 모드
            servoStates[i] = goingOpen ? INCHING_OPEN : INCHING_CLOSED;
          }
        }
        break;
      
      case INCHING_OPEN:
        if (currentLimitSwitchStates[i][0]) {
          enterStallRelief(i, targetAngles[i] + STALL_RELIEF_ANGLE, now);
        } else if ((now - lastMoveTime[i]) > INCHING_INTERVAL) {
          targetAngles[i] = max(0, (int)targetAngles[i] - 1);
          servos[i].write(targetAngles[i]);
          lastMoveTime[i] = now;
        }
        break;
    }
  }
}
```

### Emergency Shutdown 구현

**즉시 비상 대응 (arduino_mega_code.ino)**:
```cpp
static void triggerEmergency(const __FlashStringHelper* reason) {
  if (emergencyActive) return;
  emergencyActive = true;
  
  // 모든 서보 강제 오버라이드
  for (uint8_t i = 0; i < NUM_SERVOS; i++) {
    bool open = (servoRoles[i] != ROLE_MAIN); // VENT/PURGE=OPEN, MAIN=CLOSE
    servos[i].detach();
    startValveMoveForce(i, open); // 진행 중이어도 강제 실행
  }
  
  Serial.print(F("EMERG,"));
  Serial.println(reason);
}
```

**밸브 역할 정의**:
```cpp
enum ServoRole { ROLE_MAIN=0, ROLE_VENT=1, ROLE_PURGE=2 };
const uint8_t servoRoles[NUM_SERVOS] = {
  ROLE_PURGE, // V0: Ethanol Purge Line
  ROLE_MAIN,  // V1: Main Pressurization  
  ROLE_MAIN,  // V2: Ethanol Fill Line
  ROLE_MAIN,  // V3: N2O Main Supply
  ROLE_MAIN,  // V4: Ethanol Main Supply
  ROLE_VENT,  // V5: System Vent 1
  ROLE_VENT   // V6: System Vent 2
};
```

### 시스템 재-ARM 로직

**비상 해제 절차**:
```cpp
if (strcmp(payload, "SAFE_CLEAR") == 0) {
  emergencyActive = false;
  heartbeatArmed = false; // 재무장 위해 새 HB 요구
  lastHeartbeatMs = millis();
  sendAck(msgId);
  Serial.println(F("EMERG_CLEARED"));
  return;
}
```

**GUI 재-ARM 확인 (main.ts)**:
```typescript
ipcMain.handle('system-arm', async () => {
  try {
    this.requiresArm = false;
    console.info('[SAFETY] System re-armed - control commands enabled');
    return true;
  } catch (err) {
    return false;
  }
});
```

---

## 설정 관리

### config.json 상세 설정

```json
{
  "serial": {
    "baudRate": 115200
  },
  "maxChartDataPoints": 100,
  "pressureLimitPsi": 850,           // 레거시 (하위 호환)
  "pressureLimitAlarmPsi": 850,      // 소프트웨어 알람 임계값
  "pressureLimitTripPsi": 1000,      // 하드웨어 트립 임계값  
  "pressureRateLimitPsiPerSec": 50,  // 압력 변화율 제한
  "valveFeedbackTimeout": 2000,      // 밸브 응답 타임아웃 (ms)
  
  "initialValves": [
    { 
      "id": 1, 
      "name": "Ethanol Purge Line", 
      "state": "CLOSED",
      "lsOpen": false, 
      "lsClosed": false 
    },
    // ... 7개 밸브 초기 상태
  ],
  
  "valveMappings": {
    "Ethanol Purge Line": { "servoIndex": 0 },
    "Main Pressurization": { "servoIndex": 1 },
    "Ethanol Fill Line": { "servoIndex": 2 },
    "N2O Main Supply": { "servoIndex": 3 },
    "Ethanol Main Supply": { "servoIndex": 4 },
    "System Vent 1": { "servoIndex": 5 },
    "System Vent 2": { "servoIndex": 6 }
  }
}
```

### 밸브 매핑 상세

| 서보 인덱스 | 밸브명 | 물리적 기능 | Arduino 핀 | 역할 | 사용 단계 |
|-------------|--------|-------------|------------|------|-----------|
| **SV0** | Ethanol Purge Line | 에탄올 라인 퍼지 | 핀 13 | PURGE | 1, 5-6단계 |
| **SV1** | Main Pressurization | 시스템 가압 (600 psi) | 핀 12 | MAIN | 3단계 |
| **SV2** | Ethanol Fill Line | 에탄올 충전 라인 | 핀 11 | MAIN | 2단계 |
| **SV3** | N2O Main Supply | 산화제 주 공급 | 핀 10 | MAIN | 4단계 |
| **SV4** | Ethanol Main Supply | 연료 주 공급 | 핀 9 | MAIN | 4단계 |
| **SV5** | System Vent 1 | 1차 시스템 벤트 | 핀 8 | VENT | 5-6단계 |
| **SV6** | System Vent 2 | 2차 시스템 벤트 | 핀 7 | VENT | 5-6단계 |

### 서보 캘리브레이션 상수

**Arduino 펌웨어 설정**:
```cpp
// 각 서보의 개방/닫힘 각도 (하드웨어 특성에 맞춰 조정)
const uint8_t initialOpenAngles[NUM_SERVOS]   = {7,25,12,13,27,34,16};
const uint8_t initialClosedAngles[NUM_SERVOS] = {103,121,105,117,129,135,120};

// 서보 PWM 핀 배치
const uint8_t servoPins[NUM_SERVOS] = {13,12,11,10,9,8,7};

// 리미트 스위치 핀 배치 (각 밸브당 OPEN/CLOSED 쌍)
const uint8_t limitSwitchPins[NUM_SERVOS][2] = {
  {22,23}, {24,25}, {26,27}, {28,29}, 
  {30,31}, {32,33}, {34,35}
};
```

### 센서 교정 및 변환

**압력 센서 변환**:
```cpp
// ADC 값 → PSI 변환 (0-1023 ADC → 0-1000 PSI)
uint32_t psi100 = (uint32_t)((adcVal * 100000UL) / 1023UL);
// 전송: psi100 (PSI × 100)
// GUI 표시: psi100 / 100.0 PSI
```

**온도 센서 변환**:
```cpp
// MAX6675 → 섭씨 온도
float celsius = thermocouple.readCelsius();
int32_t tempCelsius_mC = (int32_t)(celsius * 1000.0f);

// 켈빈 변환 후 전송
int32_t kelvin100 = (tempCelsius_mC + 273150) / 10;
// GUI에서 다시 섭씨로 변환: (kelvin100/100) - 273.15
```

**유량 센서 변환**:
```cpp
// 펄스 카운트 → 유량 계산
uint32_t deltaCount = pulseCounts[i] - lastPulseCounts[i];
float deltaTimeS = (now - lastFlowCalcMs) / 1000.0f;
float pulsesPerSec = deltaCount / deltaTimeS;

// 유량 변환 (센서 특성에 따라 조정)
float m3h = pulsesPerSec * PULSE_TO_M3H_FACTOR;
uint16_t flowRates_m3h_1e4 = (uint16_t)(m3h * 10000.0f);
```

---

## 데이터 로깅

### 자동 세션 관리

**세션 디렉터리 구조**:
```
Documents/rocket-logs/
└── session-2025-08-20-143022/
    ├── data.csv              # 센서 데이터 로그
    ├── config.json           # 설정 백업
    ├── sequences.json        # 시퀀스 백업  
    ├── session-meta.json     # 메타데이터
    └── system-log.txt        # 시스템 메시지 로그
```

**session-meta.json 구조**:
```json
{
  "sessionId": "session-2025-08-20-143022",
  "startTime": "2025-08-20T14:30:22.123Z",
  "endTime": "2025-08-20T15:45:33.456Z", 
  "commitHash": "f544606abc123...",
  "configHash": "08e9fdfeed1b95ffb0d1d41c2a0859f5538f915d765d9c9b4005815117eeca93",
  "sequencesHash": "a1b2c3d4e5f6...",
  "version": "2.6.0",
  "operatingSystem": "Windows 11",
  "totalDataPoints": 12847,
  "emergencyEvents": [],
  "sequencesExecuted": [
    {
      "name": "Pre-Test Nitrogen Purge",
      "startTime": "2025-08-20T14:32:15.789Z",
      "endTime": "2025-08-20T14:32:40.123Z",
      "success": true
    }
  ]
}
```

### CSV 데이터 형식

**data.csv 헤더**:
```csv
timestamp,pt1,pt2,pt3,pt4,tc1,tc2,flow1,flow2,v1_state,v1_ls_open,v1_ls_closed,v2_state,v2_ls_open,v2_ls_closed,v3_state,v3_ls_open,v3_ls_closed,v4_state,v4_ls_open,v4_ls_closed,v5_state,v5_ls_open,v5_ls_closed,v6_state,v6_ls_open,v6_ls_closed,v7_state,v7_ls_open,v7_ls_closed
```

**실제 데이터 예시**:
```csv
2025-08-20T14:30:22.123Z,150.25,125.67,89.12,76.43,20.1,21.3,125.5,98.2,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1
2025-08-20T14:30:22.223Z,150.31,125.72,89.08,76.51,20.2,21.4,126.1,98.7,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1,CLOSED,0,1
```

### 로깅 구현 (LogManager.ts)

**세션 시작**:
```typescript
start(mainWindow: BrowserWindow | null, config: any) {
  const now = new Date();
  const sessionId = `session-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  
  this.sessionDir = path.join(os.homedir(), 'Documents', 'rocket-logs', sessionId);
  fs.mkdirSync(this.sessionDir, { recursive: true });
  
  // 설정 파일 백업
  const configBackupPath = path.join(this.sessionDir, 'config.json');
  fs.copyFileSync('config.json', configBackupPath);
  
  const sequencesBackupPath = path.join(this.sessionDir, 'sequences.json'); 
  fs.copyFileSync('sequences.json', sequencesBackupPath);
  
  // 메타데이터 생성
  this.sessionMeta = {
    sessionId,
    startTime: now.toISOString(),
    commitHash: this.getGitCommitHash(),
    configHash: this.calculateFileHash('config.json'),
    sequencesHash: this.calculateFileHash('sequences.json'),
    // ...
  };
}
```

**실시간 데이터 기록**:
```typescript
write(formattedLine: string) {
  if (!this.logStream) return;
  
  this.buffer.push(formattedLine);
  
  // 버퍼링된 쓰기 (성능 최적화)
  if (this.buffer.length >= this.bufferSize || this.forceFlush) {
    const dataToWrite = this.buffer.join('\n') + '\n';
    this.logStream.write(dataToWrite);
    this.buffer = [];
    this.forceFlush = false;
  }
}

// 2초마다 자동 플러시
private startAutoFlush() {
  this.autoFlushInterval = setInterval(() => {
    if (this.buffer.length > 0) {
      this.forceFlush = true;
      this.write('');
    }
  }, this.autoFlushIntervalMs);
}
```

### SHA256 해시 검증

**파일 무결성 확인**:
```typescript
private calculateFileHash(filePath: string): string {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return 'FILE_NOT_FOUND';
  }
}
```

### 핫파이어 고속 로깅

**중요 이벤트 시 1초 간격 플러시**:
```typescript
// SequenceEngine에서 Hot-Fire 시퀀스 감지
if (sequenceName.includes('Hot-Fire')) {
  this.logManager.setFastFlush(true); // 1초 간격
}

// 시퀀스 완료 후 정상 플러시로 복구
onSequenceComplete() {
  this.logManager.setFastFlush(false); // 2초 간격
}
```

---

## 문제해결

### 일반적인 문제 및 해결책

#### 연결 문제

| 증상 | 원인 | 진단 | 해결책 |
|------|------|------|--------|
| COM 포트 감지되지 않음 | Arduino 드라이버 | 장치 관리자 확인 | CH340/FTDI 드라이버 설치 |
| "연결 실패" 오류 | 보드레이트 불일치 | 시리얼 모니터 테스트 | Arduino/GUI 모두 115200 baud 확인 |
| 데이터 수신 안됨 | 펌웨어 미업로드 | Arduino IDE 확인 | arduino_mega_code.ino 재업로드 |
| 간헐적 연결 끊김 | USB 케이블/전원 | 전원 LED 확인 | 고품질 케이블, 충분한 전원 공급 |
| "FRAME_ERR" NACK | CRC 오류/노이즈 | 터미널에서 NACK 확인 | USB 차폐 케이블, 그라운드 연결 |

#### 센서 데이터 문제

| 증상 | 원인 | 진단 방법 | 해결책 |
|------|------|-----------|--------|
| 압력값 0 또는 NaN | 센서 연결 불량 | ADC 핀 전압 측정 | 배선 점검, 센서 전원 확인 |
| 온도 "ERR" 표시 | MAX6675 문제 | SPI 통신 확인 | 센서 교체, SPI 배선 점검 |
| 유량 데이터 없음 | 인터럽트 미작동 | 펄스 신호 확인 | 풀업 저항, 신호 레벨 확인 |
| CRC 불일치 오류 | 데이터 무결성 | Terminal에서 원본 확인 | 노이즈 제거, 케이블 점검 |

#### 밸브 제어 문제  

| 증상 | 원인 | 진단 | 해결책 |
|------|------|------|--------|
| "BUSY" NACK 응답 | 서보 이미 동작 중 | 서보 상태 확인 | 이전 동작 완료 대기 |
| 밸브 동작하지 않음 | 전원/PWM 문제 | 서보 전원, PWM 신호 확인 | 6V 서보 전원, PWM 케이블 점검 |
| 리미트 스위치 오동작 | 기계적 문제 | 스위치 상태 수동 확인 | 스위치 조정, 접점 청소 |
| 타임아웃 오류 | 피드백 지연 | valveFeedbackTimeout 확인 | 타임아웃 값 증가 (2000ms → 5000ms) |

#### 시퀀스 실행 문제

| 증상 | 원인 | 진단 | 해결책 |
|------|------|------|--------|
| 시퀀스 로딩 실패 | JSON 구문 오류 | `npm run validate:seq` 실행 | sequences.json 구문 수정 |
| 조건 대기 타임아웃 | 센서값 도달하지 않음 | 실제 센서값과 조건 비교 | 조건값 조정 또는 타임아웃 연장 |
| 시퀀스 중단 | 안전 인터록 위반 | Terminal에서 에러 메시지 확인 | 안전 조건 확인, 밸브 상태 점검 |
| Emergency 자동 트리거 | 압력/통신 문제 | 센서 데이터 및 하트비트 확인 | 센서 교정, 통신 안정성 개선 |

#### 안전 시스템 문제

| 증상 | 원인 | 진단 | 해결책 |
|------|------|------|--------|
| 거짓 압력 알람 | 센서 노이즈 | 압력 그래프에서 스파이크 확인 | 센서 필터링, 임계값 미세 조정 |
| Emergency 해제되지 않음 | MCU 상태 이상 | Arduino 시리얼 모니터 확인 | 전원 순환, SAFE_CLEAR 재시도 |
| 하트비트 타임아웃 | 통신 지연 | 터미널에서 HB 주기 확인 | USB 전용 포트, 시스템 성능 개선 |
| System ARM 실패 | 재-ARM 로직 문제 | requiresArm 상태 확인 | GUI 재시작, ARM 버튼 재클릭 |

### 고급 진단 도구

#### 실시간 모니터링

**Arduino 시리얼 모니터 직접 연결**:
```
Arduino IDE → Tools → Serial Monitor (115200 baud)
명령 테스트:
- HELLO,1,XX → READY + ACK,1 응답 확인
- V,0,O,2,XX → 밸브 동작 + ACK,2 응답
- HB,3,XX → 하트비트 + ACK,3 응답
```

**GUI Terminal Panel 활용**:
```
실시간 로그 필터링:
- ACK/NACK: 명령 응답 추적
- EMERG: 비상 상황 발생 추적  
- CRC 오류: 데이터 무결성 문제
- 센서 데이터: 실시간 값 변화 관찰
```

#### 로그 분석

**세션 로그 분석**:
```bash
# 특정 패턴 검색
grep -n "NACK" Documents/rocket-logs/session-*/system-log.txt
grep -n "CRC" Documents/rocket-logs/session-*/system-log.txt  
grep -n "EMERG" Documents/rocket-logs/session-*/system-log.txt

# 압력 데이터 트렌드 분석
awk -F',' '{print $2}' Documents/rocket-logs/session-*/data.csv | tail -100
```

**성능 분석**:
```bash
# 메모리 사용량 모니터링
tasklist /fi "imagename eq electron.exe" /fo csv

# CPU 사용률 확인  
wmic process where name="electron.exe" get percentprocessortime

# USB 통신 속도 테스트
# (Arduino IDE Serial Monitor에서 대량 데이터 전송 테스트)
```

### 복구 절차

#### 완전 시스템 리셋

1. **Arduino 하드 리셋**:
   ```
   - USB 연결 해제
   - 전원 공급 중단 (10초)
   - 펌웨어 재업로드
   - 전원 공급 재개
   - USB 재연결
   ```

2. **GUI 애플리케이션 리셋**:
   ```bash
   # 프로세스 강제 종료
   taskkill /f /im electron.exe
   
   # 설정 초기화
   del config.json.bak 
   cp config.json.default config.json
   
   # 애플리케이션 재시작
   npm run dev
   ```

3. **네트워크/USB 스택 리셋** (Windows):
   ```powershell
   # 관리자 권한 PowerShell
   Get-PnpDevice -Class USB | Disable-PnpDevice -Confirm:$false
   Start-Sleep -Seconds 5
   Get-PnpDevice -Class USB | Enable-PnpDevice -Confirm:$false
   ```

#### 비상상황 복구

**Emergency 상태에서 수동 복구**:
```
1. GUI Emergency 버튼 → 모든 제어 잠금
2. Arduino 물리적 전원 차단 → 완전 정지
3. 하드웨어 상태 점검 → 압력, 밸브 위치
4. 원인 분석 → 로그, 센서 데이터 확인
5. 문제 해결 → 센서 교정, 배선 수정
6. 시스템 재시작 → 펌웨어 재로드
7. Safety Clear → 3초 홀드로 해제
8. System ARM → 재무장 후 정상 운영
```

---

## 시스템 사양

### 하드웨어 요구사항

**제어 컴퓨터**
- **CPU**: Intel/AMD 쿼드코어 2.5GHz 이상 (실시간 처리용)
- **RAM**: 8GB DDR4 이상 (16GB 권장)
- **저장장치**: SSD 256GB 이상 (로깅 성능용)
- **OS**: Windows 10/11 64-bit (Build 1809 이상)
- **USB**: USB 3.0 이상 (Arduino 전용 포트)
- **그래픽**: DirectX 11 지원 (차트 렌더링용)

**MCU 및 인터페이스**
- **MCU**: Arduino Mega 2560 R3 (ATmega2560, 256KB 플래시)
- **클럭**: 16MHz (실시간 처리 보장)
- **전원**: 외부 7-12V DC, 2A 이상 (USB 전원 부족)
- **통신**: USB 2.0 A-B (115200 baud, CRC 프로토콜)

**센서 시스템**
- **압력 센서**: 4채널 0-1000 PSI 아날로그 출력
- **온도 센서**: K형 열전대 + MAX6675 SPI 인터페이스
- **유량 센서**: 펄스 출력, 최소 10Hz-1kHz 범위
- **정확도**: 압력 ±0.5%, 온도 ±2°C, 유량 ±2%

**액추에이터 시스템**  
- **서보 모터**: 7개 표준 PWM 서보 (0.1초 응답)
- **리미트 스위치**: 각 밸브당 OPEN/CLOSED 마이크로스위치
- **서보 전원**: 별도 6V/10A 용량 (동시 구동용)
- **토크**: 최소 10kg·cm (고압 밸브 구동용)

### 소프트웨어 스택

**프런트엔드 (Renderer Process)**
- **React**: 18.3.1 (함수형 컴포넌트 + Hooks)
- **Next.js**: 15.3.3 (App Router, SSG/SSR)
- **TypeScript**: 5.x (strict 모드, 완전 타입 안전)
- **Tailwind CSS**: 3.4.x (유틸리티 우선 스타일링)
- **Radix UI**: 최신 (접근성 우선 컴포넌트)
- **Recharts**: 2.15.x (실시간 차트 렌더링)

**백엔드 (Main Process)**
- **Electron**: 37.2.3 (데스크톱 앱 래퍼)
- **Node.js**: LTS 20.x (백엔드 런타임)
- **SerialPort**: 10.5.0 (USB 하드웨어 통신)
- **TypeScript**: 5.x (백엔드도 완전 타입 안전)

**개발 도구**
- **ESLint**: Airbnb 규칙 + TypeScript 확장
- **Prettier**: 자동 코드 포맷팅
- **Jest**: 단위 테스트 (커버리지 90% 이상)
- **Electron Builder**: 크로스 플랫폼 패키징

### 통신 및 프로토콜

**USB 시리얼 통신**
- **속도**: 115200 baud (안정성과 속도 균형)
- **프로토콜**: 커스텀 CRC-8 프레임 기반
- **신뢰성**: ACK/NACK 응답, 자동 재전송
- **지연**: 명령-응답 평균 10ms, 최대 100ms

**데이터 무결성**
- **CRC-8**: 다항식 0x07, 룩업 테이블 기반
- **프레임 구조**: "PAYLOAD,MSG_ID,CRC_HEX"
- **오류 감지**: 비트 오류, 순서 오류, 중복 감지
- **복구**: NACK 시 자동 재전송 (최대 5회)

**실시간 성능**
- **센서 업데이트**: 100ms 주기 (10Hz)
- **명령 응답**: ACK 타임아웃 1.5초
- **비상 응답**: 하드웨어 < 100ms, 소프트웨어 < 400ms
- **하트비트**: 3초 타임아웃 (통신 감시)

### 메모리 및 저장소

**런타임 메모리**
- **GUI 프로세스**: 평균 200MB, 최대 500MB
- **백엔드 프로세스**: 평균 100MB, 최대 200MB  
- **총 메모리**: 8GB 시스템에서 안정적 동작
- **메모리 누수**: 24시간 연속 운영 검증

**데이터 저장**
- **설정 파일**: JSON 형식 (~10KB)
- **시퀀스 정의**: JSON 형식 (~50KB)
- **세션 로그**: CSV + JSON (~100MB/시간)
- **롤링 로그**: 최대 30일, 자동 정리

**백업 및 복구**
- **자동 백업**: 각 세션마다 설정 파일 복사
- **SHA256 해시**: 파일 무결성 검증
- **메타데이터**: Git 커밋, 시간, 버전 추적
- **복구 도구**: 설정 롤백, 세션 재현

### 성능 벤치마크

| 지표 | 목표값 | 측정값 | 상태 | 최적화 방법 |
|------|--------|--------|------|-------------|
| **센서 지연** | < 20ms | 8-12ms | ✅ 양호 | ADC 백그라운드 샘플링 |
| **명령 응답** | < 100ms | 45-85ms | ✅ 양호 | CRC 하드웨어 룩업 테이블 |
| **메모리 사용** | < 600MB | 420MB | ✅ 양호 | React 메모이제이션 |
| **CPU 사용률** | < 30% | 15-25% | ✅ 양호 | 비동기 처리 최적화 |
| **차트 FPS** | > 30 FPS | 45-60 FPS | ✅ 양호 | Canvas 렌더링 |
| **로그 처리** | > 1000 라인/초 | 2500 라인/초 | ✅ 양호 | 버퍼링 배치 쓰기 |

### 확장성 및 호환성

**하드웨어 확장**
- **추가 센서**: 아날로그 핀 A6-A15 사용 가능
- **추가 밸브**: 디지털 핀 36-53 확장 가능  
- **통신 확장**: SPI/I2C를 통한 외부 모듈
- **전력 확장**: 릴레이 모듈을 통한 고전력 장치

**소프트웨어 확장**
- **시퀀스 추가**: sequences.json 편집으로 간단 확장
- **센서 타입**: sensorParser.ts 수정으로 새 센서 지원
- **통신 프로토콜**: SerialManager 확장 가능
- **UI 커스터마이징**: React 컴포넌트 기반 모듈형 구조

**크로스 플랫폼**
- **Windows**: 완전 지원 (기본 플랫폼)
- **macOS**: Electron 호환 (시리얼 포트 조정 필요)
- **Linux**: 부분 지원 (권한 설정 필요)
- **웹 배포**: Next.js 정적 빌드로 웹 버전 가능

---

**업데이트**: 2025년 8월 20일  
**버전**: v2.6.0  
**개발**: GoRocket Team  
**저장소**: https://github.com/jungho1902/Gorocket-Control-System-GUI

**중요**: 이 시스템은 고압 유체 및 위험한 로켓 추진제를 다룹니다. 운영 전 충분한 안전 교육을 받고 모든 안전 수칙을 준수하십시오.