<img width="2879" height="1707" alt="image" src="https://github.com/user-attachments/assets/9ed51db3-f4d9-49a1-b5fd-7456a9212430" />

# GoRocket Control System GUI

로켓 엔진 테스트용 제어 및 모니터링 GUI 시스템

## 🚀 프로젝트 개요

GoRocket Control System GUI는 로켓 엔진 테스트 스탠드를 위한 전문적인 제어 및 모니터링 시스템입니다. 복잡한 로켓 추진제 시스템을 안전하고 정밀하게 제어할 수 있도록 설계된 Electron 기반 데스크톱 애플리케이션입니다.

이 시스템은 실시간 센서 모니터링, 자동화된 밸브 제어, 사전 정의된 테스트 시퀀스 실행, 그리고 포괄적인 데이터 로깅 기능을 제공하여 로켓 엔진 테스트의 안전성과 효율성을 크게 향상시킵니다.

## ✨ 주요 특징

- **실시간 센서 모니터링**: 8개 센서(압력 4개, 유량 2개, 온도 2개)의 실시간 데이터 시각화
- **지능형 밸브 제어**: 7개 서보 밸브의 원격 제어 및 상태 피드백
- **자동화된 테스트 시퀀스**: 사전 정의된 안전한 테스트 절차 실행
- **포괄적 데이터 로깅**: 모든 센서 데이터 및 시스템 이벤트 기록
- **안전 기능**: 압력 한계 모니터링 및 자동 긴급 정지

### 🛠️ 기술 스택

**Frontend**
- Next.js 15.3.3 + React 18 + TypeScript
- Tailwind CSS + Radix UI (shadcn/ui)
- Recharts (실시간 데이터 시각화)

**Backend**
- Electron 37.2.3 (데스크톱 애플리케이션)
- Node.js SerialPort (Arduino 통신)
- Ajv (JSON Schema 검증)
- Zod (타입 안전 설정 관리)

**Hardware**
- Arduino Mega 2560 (메인 MCU)
- MAX6675 온도센서 모듈 (SPI 통신)
- 압력 센서 4개 (0-5V 아날로그)
- 유량 센서 2개 (펄스 출력, 디지털 입력)
- 서보 모터 7개 (PWM 제어)
- 리미트 스위치 14개 (디지털 입력, Pull-up)

---

## 🔧 하드웨어 구성 및 배선

### Arduino Mega 2560 핀 할당

#### 📊 센서 연결

**압력 센서 (아날로그 입력)**
- PT-1 (연료탱크): `A0` - 0-5V 아날로그 신호
- PT-2 (산화제탱크): `A1` - 0-5V 아날로그 신호  
- PT-3 (연료라인): `A2` - 0-5V 아날로그 신호
- PT-4 (산화제라인): `A3` - 0-5V 아날로그 신호
- **변환식**: `압력(PSI) = (아날로그값 / 1023.0) × 5.0V × 100bar × 14.50377`

**온도 센서 (SPI 통신)**
- TC-1 (연소실): MAX6675 모듈
  - SCK: `D52` (SPI 클록)
  - CS: `D49` (Chip Select)
  - SO: `D50` (MISO)
- TC-2 (노즐): MAX6675 모듈  
  - SCK: `D52` (공유)
  - CS: `D48` (Chip Select)
  - SO: `D50` (공유)
- **측정 범위**: 0-700°C, 0.25°C 분해능

**유량 센서 (디지털 펄스 입력)**
- Flow-1 (연료): `D2` (INT0, Rising Edge)
- Flow-2 (산화제): `D3` (INT1, Rising Edge)
- **K-Factor**: 1,484.11 pulse/L
- **변환식**: `유량(m³/h) = (펄스수 / K-Factor / 1000) × 3600 / 시간간격`
- **글리치 필터**: 최소 펄스 간격 100μs

#### 🔧 액추에이터 연결

**서보 모터 (PWM 제어)**
| 서보 | 핀 | 밸브명 | 열림각도 | 닫힘각도 |
|------|----|---------|---------|---------|
| 0 | D13 | Ethanol Main | 42° | 135° |
| 1 | D12 | N2O Main | 44° | 135° |
| 2 | D11 | Ethanol Purge | 45° | 138° |
| 3 | D10 | N2O Purge | 47° | 135° |
| 4 | D9 | Pressurant Fill | 46° | 134° |
| 5 | D8 | System Vent | 38° | 127° |
| 6 | D7 | Igniter Fuel | 45° | 135° |

**리미트 스위치 (디지털 입력, Pull-up)**
| 밸브 | Open 스위치 | Close 스위치 |
|------|-------------|-------------|
| Ethanol Main | D22 | D23 |
| N2O Main | D24 | D25 |
| Ethanol Purge | D26 | D27 |
| N2O Purge | D28 | D29 |
| Pressurant Fill | D30 | D31 |
| System Vent | D32 | D33 |
| Igniter Fuel | D34 | D35 |

### 전원 공급 및 신호 레벨

**Arduino Mega 2560**
- 메인 전원: USB 5V 또는 외부 7-12V DC
- 디지털 I/O: 3.3V/5V 호환
- 아날로그 기준전압: 5V (AREF)

**센서 전원 요구사항**
- 압력센서: 5V DC (±10%)
- MAX6675: 3.3V-5V DC
- 유량센서: 외부 18V DC (분압회로 통해 5V 레벨 변환)

**서보 모터**
- 제어신호: 5V PWM (50Hz, 1-2ms 펄스폭)
- 전원: 별도 6V DC 권장 (고토크 요구시)
- 전력 최적화: 목표 위치 도달 후 `detach()` 호출

### 배선도 및 회로 구성

```
                    Arduino Mega 2560
                    ┌─────────────────┐
    압력센서 PT1 ────┤ A0              │
    압력센서 PT2 ────┤ A1              │
    압력센서 PT3 ────┤ A2              │  
    압력센서 PT4 ────┤ A3              │
                    │                 │
    유량센서 Flow1 ─┤ D2 (INT0)       │
    유량센서 Flow2 ─┤ D3 (INT1)       │
                    │                 │
    서보 0 ─────────┤ D13 (PWM)       │
    서보 1 ─────────┤ D12 (PWM)       │
    서보 2 ─────────┤ D11 (PWM)       │
    서보 3 ─────────┤ D10 (PWM)       │
    서보 4 ─────────┤ D9  (PWM)       │
    서보 5 ─────────┤ D8  (PWM)       │
    서보 6 ─────────┤ D7  (PWM)       │
                    │                 │
    LS 0 Open ──────┤ D22             │
    LS 0 Close ─────┤ D23             │
    LS 1 Open ──────┤ D24             │
    LS 1 Close ─────┤ D25             │
    LS 2 Open ──────┤ D26             │
    LS 2 Close ─────┤ D27             │
    LS 3 Open ──────┤ D28             │
    LS 3 Close ─────┤ D29             │
    LS 4 Open ──────┤ D30             │
    LS 4 Close ─────┤ D31             │
    LS 5 Open ──────┤ D32             │
    LS 5 Close ─────┤ D33             │
    LS 6 Open ──────┤ D34             │
    LS 6 Close ─────┤ D35             │
                    │                 │
    TC1 CS ─────────┤ D49             │
    TC2 CS ─────────┤ D48             │
    MAX6675 SO ─────┤ D50 (MISO)      │
    MAX6675 SCK ────┤ D52 (SCK)       │
                    └─────────────────┘
```

### 신호 처리 및 필터링

**압력 센서**
- 하드웨어: RC 필터 (100Ω + 100nF)
- 소프트웨어: 5점 이동평균 필터
- 업데이트 주기: 100ms

**온도 센서**  
- MAX6675 내장 필터링
- 읽기 간격: 250ms (MAX6675 최소 요구사항)
- 오류 처리: NaN 감지 및 이전값 유지

**유량 센서**
- ISR 기반 펄스 카운팅
- 글리치 필터: 100μs 최소 간격
- EWMA 필터 (τ=300ms)
- 실시간 dt 기반 유량 계산

---

## 🎯 시스템 기능

### 실시간 센서 모니터링

**센서 구성**
- **PT-1 ~ PT-4**: 압력 센서 (연료탱크, 산화제탱크, 연료라인, 산화제라인)
- **Flow-1, Flow-2**: 유량 센서 (연료/산화제 유량 측정)
- **TC-1, TC-2**: 온도 센서 (연소실/노즐 온도)

**주요 기능**
- 100ms 주기 실시간 데이터 수집
- 시계열 차트를 통한 데이터 시각화
- 압력 한계 초과 시 자동 긴급 정지 (현재: 850 PSI)
- 센서 오류 감지 및 알림

### 밸브 제어 시스템

**밸브 구성 (7개)**
1. **Ethanol Main** - 에탄올 주 공급 밸브
2. **N2O Main** - 아산화질소 주 공급 밸브  
3. **Ethanol Purge** - 에탄올 퍼지 밸브
4. **N2O Purge** - 아산화질소 퍼지 밸브
5. **Pressurant Fill** - 가압가스 공급 밸브
6. **System Vent** - 시스템 벤트 밸브
7. **Igniter Fuel** - 점화기 연료 밸브

**제어 기능**
- 개별 밸브 원격 제어 (Open/Close)
- 리미트 스위치를 통한 실시간 상태 피드백
- 밸브 응답 타임아웃 모니터링 (기본 2초)
- 서보 모터 전력 최적화 (목표 위치 도달 시 자동 분리)

### 자동화된 테스트 시퀀스

**사전 정의된 시퀀스**
1. **Pre-Test Purge**: 테스트 전 라인 퍼지
2. **Tank Pressurization**: 탱크 가압 (PT1 ≥ 50 PSI 대기)
3. **Engine Chill & Pre-Flow**: 엔진 냉각 및 사전 유량 설정
4. **Igniter Arm**: 점화기 활성화
5. **Safe Vent**: 안전 벤트 절차
6. **Emergency Shutdown**: 긴급 정지 절차

**시퀀스 특징**
- JSON 기반 시퀀스 정의 및 실시간 리로드
- 센서 조건 기반 단계 진행
- 각 단계별 타임아웃 및 오류 처리
- 실시간 진행 상황 로깅

### 데이터 로깅 시스템

- **자동 CSV 로깅**: 모든 센서 데이터 및 시스템 이벤트
- **파일 위치**: `Documents/rocket-logs/` 디렉토리
- **파일명 형식**: `rocket-test-YYYY-MM-DD-HH-mm-ss.csv`
- **로그 내용**: 타임스탬프, 센서값, 밸브 상태, 시퀀스 이벤트
- **GUI 제어**: 시작/중지 버튼을 통한 수동 제어

### 안전 기능

- **압력 한계 모니터링**: 설정값 초과 시 자동 Emergency Shutdown
- **밸브 피드백 검증**: 명령 후 리미트 스위치 응답 확인
- **통신 상태 감시**: 시리얼 연결 상태 실시간 모니터링
- **시퀀스 중단**: 언제든지 수동 시퀀스 중단 가능

---

## 🏗️ 시스템 아키텍처

### 전체 시스템 구조

```
┌─────────────────────────────────────┐
│           Frontend Layer            │
│      (Next.js + React + TS)         │  ← 사용자 인터페이스
│   ┌─────────────────────────────┐   │
│   │  Dashboard Components       │   │
│   │  • SensorPanel              │   │
│   │  • ValveDisplay             │   │
│   │  • SequencePanel            │   │  
│   │  • DataChartPanel           │   │
│   │  • TerminalPanel            │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
                   │
              IPC 통신 (preload.ts)
                   │
┌─────────────────────────────────────┐
│           Electron Main             │
│         (Node.js + TS)              │  ← 백엔드 로직
│   ┌─────────────────────────────┐   │
│   │  Core Managers              │   │
│   │  • SerialManager            │   │
│   │  • ConfigManager            │   │
│   │  • SequenceDataManager      │   │
│   │  • LogManager               │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
                   │
            SerialPort 통신 (115200 bps)
                   │
┌─────────────────────────────────────┐
│         Arduino Mega 2560           │
│            (C++ 펌웨어)             │  ← 하드웨어 제어
│   ┌─────────────────────────────┐   │
│   │  Hardware Control           │   │
│   │  • 7x Servo Motors          │   │
│   │  • 14x Limit Switches       │   │
│   │  • 4x Pressure Sensors      │   │
│   │  • 2x Flow Sensors          │   │
│   │  • 2x Temperature Sensors   │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 주요 구성 요소

**Frontend Layer (src/)**
- **대시보드 컴포넌트**: 센서 데이터, 밸브 상태, 시퀀스 제어 UI
- **React Hooks**: 데이터 관리 및 비즈니스 로직 (`useSerialManager`, `useSequenceManager`)
- **실시간 차트**: Recharts를 이용한 센서 데이터 시각화

**Backend Layer (main/)**
- **SerialManager**: Arduino와의 시리얼 통신 및 명령어 처리
- **ConfigManager**: 설정 파일 로딩 및 타입 검증 (Zod 사용)
- **SequenceDataManager**: 시퀀스 파일 관리 및 JSON Schema 검증
- **LogManager**: CSV 형태 데이터 로깅 시스템

**Hardware Layer (arduino_mega_code/)**
- **센서 인터페이스**: 아날로그/디지털 센서 데이터 수집
- **서보 제어**: 상태 머신 기반 정밀 밸브 제어
- **통신 프로토콜**: 견고한 시리얼 명령어 파싱 및 응답

---

## 🧭 시스템 전체 동작 시퀀스 (상세 분석)

### Phase 1: 사전 준비 및 애플리케이션 실행

1. **하드웨어(아두이노) 전원 인가**
   - `setup()` 실행 시 시리얼 포트를 115200bps로 초기화하고 20ms 타임아웃을 지정해 통신 안정성을 확보합니다
   - 모든 서보의 제어선을 `detach()`로 해제하여 전력 소모를 최소화합니다. 이는 서보 전원을 끊는 것이 아니라 제어 신호만 제거하는 동작입니다.
   - 리미트 스위치 핀은 내부 풀업 저항(INPUT_PULLUP)으로, 유량 센서 핀은 외부 분압 회로(NPN 오픈 컬렉터) 때문에 풀업 없이 INPUT 모드로 설정해 시작 시 불필요한 동작을 방지합니다.
   - SPI 및 열전대 모듈을 초기화한 후 "Initialization complete" 메시지를 출력하고 `loop()`에서 명령 또는 센서 이벤트를 기다립니다

2. **소프트웨어(GUI) 실행**
   - `npm run dev` 명령은 Next.js 개발 서버와 Electron 메인 프로세스를 동시에 구동하여 프론트엔드와 백엔드가 함께 동작하도록 합니다
   - `main.ts`는 실행 즉시 `config.json`을 읽고 `SequenceDataManager`를 초기화하여 시퀀스 파일을 검증 및 감시합니다. 이후 `BrowserWindow`를 생성하고 IPC 채널을 세팅합니다
   - 개발 모드에서는 `http://localhost:9002` 주소를 로드하며, `preload.js`를 통해 렌더러 프로세스가 Node 기능에 직접 접근하지 않고도 안전하게 IPC 통신을 수행합니다

### Phase 2: 아두이노와 연결 수립

1. **포트 목록 조회 및 기본 설정**
   - 프론트엔드 초기화 시 사용 가능한 포트 목록과 설정을 불러오고 첫 번째 포트를 기본 선택합니다. 로딩 실패 시 UI에 경고를 띄우고 긴급 시퀀스를 비활성화합니다

2. **연결 요청 및 핸드셰이크**
   - 사용자가 UI에서 "연결"을 누르면 `handleConnect`가 포트 선택 여부를 확인한 뒤 `connectSerial` IPC를 호출합니다
   - `SerialManager.connect`는 포트를 열고 5초간 연결을 확인한 뒤 `HELLO\n`을 전송하여 3초 내 `READY` 응답을 기대합니다. 타임아웃이나 오류 발생 시 자동으로 포트를 닫고 실패를 반환합니다
   - 연결 후 포트가 예기치 않게 닫히면 오류 이벤트를 발생시키고 UI에 전달합니다

3. **연결 상태 반영**
   - 핸드셰이크 성공 시 UI 상태가 `connected`로 전환되며, 실패 또는 오류 시 `disconnected`로 복귀하고 로그에 메시지를 기록합니다

### Phase 3: 정상 작동 (데이터 흐름 및 제어)

1. **데이터 흐름 (아두이노 → UI)**
   - `loop()` 함수는 100ms 주기로 센서 값을 읽어 `pt1/2/3/4`, `flow1/2`, `tc1/2`, 리미트 스위치 상태를 CSV 형태 문자열로 전송합니다
   - Electron 메인 프로세스는 수신한 데이터를 렌더러에 중계하고, 로깅이 활성화된 경우 `LogManager`가 CSV 파일로 기록합니다
   - 프론트엔드는 `parseSensorData`로 문자열을 구조화하고 차트·상태를 갱신합니다. 압력이 설정 임계값을 넘으면 긴급 시퀀스를 요청합니다

2. **명령 흐름 (UI → 아두이노)**
   - 밸브 제어 버튼은 `V,<index>,<O|C>` 형태의 명령을 생성하며 UI와 설정된 서보 매핑을 사용합니다
   - `SerialManager.send`가 문자열을 전송하면 아두이노 `handleValveCommand`가 서보를 구동합니다
   - 펌웨어의 서보 상태 머신은 리미트 스위치 피드백을 감시하고 목표 각도에 도달하면 서보를 분리해 전력 소모를 최소화합니다

3. **자동 시퀀스 및 피드백 검증**
   - `SequenceDataManager`는 `src/sequences.json`을 실시간 감시하여 변경 내용을 UI로 전파합니다
   - `useSequenceManager`는 단계별로 명령을 실행하고 각 명령 후 리미트 스위치가 지정된 시간 내 응답하는지 검사합니다. 응답 누락 시 자동으로 'Emergency Shutdown' 시퀀스를 호출합니다

4. **압력 기준 초과 시 긴급 정지**
   - `useSensorData`가 압력 한계를 넘는 데이터를 감지하면 `handleEmergency`를 호출하여 즉시 'Emergency Shutdown' 시퀀스를 시작합니다

### Phase 4: 연결 종료

1. **정상적인 연결 해제**
   - 사용자가 "연결 해제"를 누르면 `disconnectSerial` IPC가 호출되어 포트를 안전하게 닫고 내부 상태를 초기화합니다

2. **비정상적인 연결 끊김**
   - USB 분리 등으로 포트가 갑자기 닫히면 `SerialManager`가 오류 이벤트를 발생시키고 UI는 즉시 연결 해제를 표시합니다

### Phase 5: 데이터 로깅

1. **로그 시작/중지 및 파일 기록**
   - UI의 로그 토글은 `start-logging`/`stop-logging` IPC를 통해 `LogManager`를 제어하며, 생성 실패 시 UI에 알립니다
   - 로그는 사용자 문서 폴더 아래 `rocket-logs`에 CSV로 저장되고, 파싱 오류는 `#` 주석으로 기록하여 문제 데이터를 추적할 수 있게 합니다

## 📂 프로젝트 구조

```
Gorocket-Control-System-GUI/
│
├── 📁 src/                          # Frontend (React + Next.js)
│   ├── 📁 app/                      # Next.js App Router
│   │   ├── layout.tsx               # 전체 앱 레이아웃
│   │   ├── page.tsx                 # 메인 대시보드
│   │   └── globals.css              # 전역 스타일
│   ├── 📁 components/               # UI 컴포넌트
│   │   ├── 📁 dashboard/            # 대시보드 전용 컴포넌트
│   │   │   ├── header.tsx           # 연결 상태 & 로깅 제어
│   │   │   ├── sensor-panel.tsx     # 8개 센서 데이터 표시
│   │   │   ├── valve-display.tsx    # 7개 밸브 제어 & 상태
│   │   │   ├── sequence-panel.tsx   # 자동 시퀀스 제어
│   │   │   ├── terminal-panel.tsx   # 실시간 로그 출력
│   │   │   └── data-chart-panel.tsx # 센서 데이터 차트
│   │   └── 📁 ui/                   # 재사용 가능한 UI 컴포넌트 (shadcn/ui)
│   ├── 📁 hooks/                    # React Hooks
│   │   ├── useSerialManager.ts      # 시리얼 통신 & 센서 데이터 관리
│   │   ├── useSequenceManager.ts    # 자동 시퀀스 실행 관리
│   │   └── useValveControl.ts       # 밸브 제어 로직
│   └── 📁 lib/                      # 유틸리티 함수
│
├── 📁 main/                         # Backend (Electron Main Process)
│   ├── SerialManager.ts             # Arduino 시리얼 통신
│   ├── ConfigManager.ts             # 설정 파일 관리
│   ├── SequenceDataManager.ts       # 시퀀스 데이터 관리 & 검증
│   └── LogManager.ts                # 데이터 로깅 시스템
│
├── 📁 shared/                       # 공통 타입 & 유틸리티
│   ├── 📁 types/                    # TypeScript 타입 정의
│   │   ├── index.ts                 # SensorData, Valve 등 핵심 타입
│   │   ├── ipc.ts                   # IPC 통신 타입
│   │   └── global.d.ts              # 전역 타입 선언
│   └── 📁 utils/
│       └── sensorParser.ts          # 센서 데이터 파싱 로직
│
├── 📁 arduino_mega_code/            # Arduino 펌웨어
│   └── arduino_mega_code.ino        # Arduino Mega 2560 펌웨어
│
├── 📄 main.ts                       # Electron 메인 프로세스 진입점
├── 📄 preload.ts                    # 보안 IPC 브릿지
├── 📄 config.json                   # 시스템 설정 파일
├── 📄 sequences.json                # 자동 시퀀스 정의
├── 📄 sequences.schema.json         # 시퀀스 JSON 스키마
└── 📄 package.json                  # 프로젝트 의존성 & 스크립트
```

---

## ⚙️ 설치 및 설정

### 시스템 요구사항

**소프트웨어**
- Node.js 18.0 이상
- Arduino IDE 2.0 이상 (펌웨어 업로드용)
- Git (선택사항)

**하드웨어**
- Arduino Mega 2560
- USB 케이블
- Windows/macOS/Linux 운영체제

### 플랫폼별 설치 가이드

#### Windows 10/11

**1. 개발 환경 준비**
```powershell
# Windows Package Manager로 Node.js 설치 (관리자 권한)
winget install OpenJS.NodeJS

# 또는 직접 다운로드
# https://nodejs.org/ 에서 LTS 버전 다운로드 및 설치

# Git 설치 확인 (Windows에 기본 포함되지 않음)
winget install Git.Git

# Arduino IDE 설치
winget install ArduinoSA.IDE.stable
```

**2. 빌드 도구 설치 (중요!)**
```powershell
# 관리자 권한 PowerShell에서 실행
npm install -g windows-build-tools
# 또는 Visual Studio Build Tools 수동 설치:
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Python 설치 (native 모듈 빌드용)
winget install Python.Python.3.11
```

**3. 프로젝트 설정**
```powershell
git clone https://github.com/jungho1902/Gorocket-Control-System-GUI.git
cd Gorocket-Control-System-GUI

# 의존성 설치
npm install

# serialport 네이티브 모듈 빌드
npm run rebuild

# 빌드 성공 확인
npm run typecheck
```

**Windows 특정 문제 해결:**
```powershell
# MSBuild 오류 시
npm config set msbuild_path "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"

# Python 경로 오류 시  
npm config set python "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe"

# 권한 오류 시 (관리자 권한으로 실행)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### macOS (Intel/Apple Silicon)

**1. 개발 환경 준비**
```bash
# Homebrew 설치 (패키지 매니저)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node

# Arduino IDE 설치
brew install --cask arduino-ide

# Xcode Command Line Tools (C++ 컴파일러)
xcode-select --install
```

**2. Python 및 빌드 도구**
```bash
# Python (보통 macOS에 기본 설치됨)
brew install python@3.11

# 추가 개발 도구
brew install git
```

**3. 프로젝트 설정**
```bash
git clone https://github.com/jungho1902/Gorocket-Control-System-GUI.git
cd Gorocket-Control-System-GUI

# 의존성 설치
npm install

# Native 모듈 빌드
npm run rebuild

# Apple Silicon Mac에서 Rosetta 필요 시
arch -x86_64 npm run rebuild
```

**macOS 특정 설정:**
```bash
# 권한 설정 (시리얼 포트 접근)
sudo dseditgroup -o edit -a $(whoami) -t user dialout

# Arduino 포트 권한 (필요시)
sudo chmod 666 /dev/cu.usbmodem*
```

#### Ubuntu/Debian Linux

**1. 시스템 업데이트 및 기본 도구**
```bash
sudo apt update && sudo apt upgrade -y

# Node.js (NodeSource 공식 저장소 사용)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 빌드 필수 도구
sudo apt-get install -y build-essential python3 python3-pip git

# Arduino IDE
sudo apt-get install -y arduino
# 또는 최신 버전 직접 설치:
# https://downloads.arduino.cc/arduino-ide/
```

**2. 사용자 권한 설정**
```bash
# 시리얼 포트 접근 권한
sudo usermod -a -G dialout $USER
sudo usermod -a -G tty $USER

# 권한 적용을 위해 재로그인 또는 재시작
newgrp dialout
```

**3. 프로젝트 설정**
```bash
git clone https://github.com/jungho1902/Gorocket-Control-System-GUI.git
cd Gorocket-Control-System-GUI

npm install
npm run rebuild

# 권한 테스트
ls -la /dev/ttyUSB* /dev/ttyACM*
```

#### CentOS/RHEL/Fedora

**1. 패키지 관리자로 도구 설치**
```bash
# Fedora
sudo dnf install -y nodejs npm python3 gcc-c++ make git arduino

# CentOS/RHEL (EPEL 저장소 필요)
sudo yum install -y epel-release
sudo yum install -y nodejs npm python3 gcc-c++ make git
```

**2. 프로젝트 설정 (Ubuntu와 동일)**

### Docker 개발 환경 (선택사항)

**개발용 Docker 컨테이너**
```dockerfile
# Dockerfile.dev
FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    build-essential python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install

# USB 장치 접근을 위한 권한 설정
RUN usermod -a -G dialout node

EXPOSE 9002
CMD ["npm", "run", "dev"]
```

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  gorocket-gui:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /dev:/dev
    ports:
      - "9002:9002"
    privileged: true
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0
      - /dev/ttyACM0:/dev/ttyACM0
```

```bash
# Docker로 개발 환경 실행
docker-compose -f docker-compose.dev.yml up --build
```

### Arduino 펌웨어 상세 설정

#### IDE 설정 및 라이브러리

**1. Arduino IDE 보드 설정**
```
도구 > 보드 > Arduino AVR Boards > Arduino Mega or Mega 2560
도구 > 프로세서 > ATmega2560 (Mega 2560)
도구 > 포트 > [Arduino가 연결된 포트]
```

**2. 필요한 라이브러리 설치**
```
스케치 > 라이브러리 포함 > 라이브러리 관리...

검색 후 설치:
- "max6675" by Adafruit (온도센서용)
- "Servo" (기본 제공, 확인만)
```

**3. 컴파일 및 업로드 확인**
```cpp
// 시리얼 모니터에서 예상 출력:
// BOOT
// READY
// pt1:0.00,pt2:0.00,pt3:0.00,pt4:0.00,flow1:0.00,flow2:0.00,tc1:25.50,tc2:25.75,V0_LS_OPEN:0,V0_LS_CLOSED:1,...
```

### 설정 파일 상세 구성

#### config.json 템플릿
```json
{
  "serial": {
    "baudRate": 115200,
    "reconnectDelay": 3000,
    "maxRetries": 5
  },
  "sensors": {
    "pressureLimit": 850,
    "temperatureLimit": 600,
    "flowRateLimit": 10.0
  },
  "valves": {
    "feedbackTimeout": 2000,
    "retryAttempts": 3,
    "emergencyShutdownDelay": 500
  },
  "ui": {
    "maxChartDataPoints": 100,
    "updateInterval": 100,
    "theme": "light"
  },
  "logging": {
    "autoStart": false,
    "directory": "rocket-logs",
    "maxFileSizeMB": 100,
    "compressionEnabled": true
  },
  "valveMappings": {
    "Ethanol Main": { "servoIndex": 0 },
    "N2O Main": { "servoIndex": 1 },
    "Ethanol Purge": { "servoIndex": 2 },
    "N2O Purge": { "servoIndex": 3 },
    "Pressurant Fill": { "servoIndex": 4 },
    "System Vent": { "servoIndex": 5 },
    "Igniter Fuel": { "servoIndex": 6 }
  },
  "initialValves": [
    { "id": 1, "name": "Ethanol Main", "state": "CLOSED", "lsOpen": false, "lsClosed": true },
    { "id": 2, "name": "N2O Main", "state": "CLOSED", "lsOpen": false, "lsClosed": true },
    { "id": 3, "name": "Ethanol Purge", "state": "CLOSED", "lsOpen": false, "lsClosed": true },
    { "id": 4, "name": "N2O Purge", "state": "CLOSED", "lsOpen": false, "lsClosed": true },
    { "id": 5, "name": "Pressurant Fill", "state": "CLOSED", "lsOpen": false, "lsClosed": true },
    { "id": 6, "name": "System Vent", "state": "CLOSED", "lsOpen": false, "lsClosed": true },
    { "id": 7, "name": "Igniter Fuel", "state": "CLOSED", "lsOpen": false, "lsClosed": true }
  ]
}
```

#### sequences.json 사용자 정의
```json
{
  "System Check": [
    {
      "message": "Verify all sensors connected",
      "delay": 1000,
      "commands": [],
      "condition": {
        "sensor": "pt1",
        "min": 0,
        "max": 50,
        "op": "gte",
        "timeoutMs": 5000
      }
    },
    {
      "message": "Test all valves (quick cycle)",
      "delay": 0,
      "commands": [
        "CMD,Ethanol Main,Open",
        "CMD,Ethanol Main,Close",
        "CMD,N2O Main,Open", 
        "CMD,N2O Main,Close"
      ]
    }
  ],
  "Custom Test Sequence": [
    {
      "message": "Your custom step here",
      "delay": 2000,
      "commands": ["CMD,System Vent,Open"]
    }
  ]
}
```

### 환경별 트러블슈팅

#### Windows 문제점
```powershell
# 1. 직렬 포트 드라이버 이슈
# 장치 관리자 > 포트(COM & LPT) > Arduino 드라이버 업데이트

# 2. MSBuild 오류
npm install --global --production windows-build-tools

# 3. 권한 오류
Set-ExecutionPolicy Bypass -Scope Process -Force
```

#### macOS 문제점  
```bash
# 1. Gatekeeper 보안 경고
sudo spctl --master-disable  # 임시로 보안 해제
# 설정 > 보안 및 개인 정보 보호 > "확인되지 않은 개발자" 허용

# 2. 시리얼 포트 접근 불가
sudo chmod 666 /dev/cu.usbserial*
sudo chmod 666 /dev/cu.usbmodem*

# 3. Rosetta 2 (Apple Silicon)
softwareupdate --install-rosetta --agree-to-license
```

#### Linux 문제점
```bash
# 1. 시리얼 포트 권한
sudo usermod -a -G dialout $USER
sudo systemctl restart udev

# 2. AppImage 실행 권한 (Electron 빌드)
chmod +x GoRocket-Control-System-GUI-*.AppImage

# 3. GLIBC 호환성 (구버전 Linux)
ldd --version  # GLIBC 버전 확인
# 필요시 Ubuntu 20.04 이상 권장
```

---

## 🚀 실행 방법

### 개발 모드

```bash
# 개발 서버 시작 (권장)
npm run dev
```

**실행 과정**
1. Next.js 개발 서버 시작 (`localhost:9002`)
2. Electron 메인 프로세스 빌드
3. Electron 앱 실행
4. 코드 변경 시 자동 리로드

### 사용 가능한 스크립트

```bash
# 타입 검사
npm run typecheck

# 린트 검사  
npm run lint

# 시퀀스 파일 검증
npm run validate:seq

# 프로덕션 빌드 (실험적)
npm run build
npm run package
```

### 앱 사용법

1. **Arduino 연결**
   - USB 케이블로 Arduino 연결
   - 헤더에서 포트 선택 후 "연결" 클릭

2. **센서 모니터링**
   - 연결 후 자동으로 센서 데이터 수신 시작
   - 실시간 차트에서 데이터 추이 확인

3. **밸브 제어**
   - 개별 밸브 수동 제어 가능
   - 리미트 스위치 상태 실시간 확인

4. **자동 시퀀스 실행**
   - 사전 정의된 시퀀스 선택 후 실행
   - 터미널에서 진행 상황 모니터링

5. **데이터 로깅**
   - "로깅 시작" 버튼으로 데이터 기록 시작
   - `Documents/rocket-logs/` 폴더에 CSV 저장

---

## 🔧 시퀀스 및 설정 커스터마이징

### 자동 시퀀스 수정

시퀀스는 `sequences.json` 파일에서 정의되며, JSON Schema 기반 검증을 통해 안전성을 보장합니다.

**현재 시퀀스**
- `Pre-Test Purge`: 테스트 전 라인 퍼지
- `Tank Pressurization`: 탱크 가압 (PT1 ≥ 50 PSI)
- `Engine Chill & Pre-Flow`: 엔진 냉각 및 사전 유량
- `Igniter Arm`: 점화기 활성화
- `Safe Vent`: 안전 벤트 절차
- `Emergency Shutdown`: 긴급 정지

**시퀀스 구조 예시**
```json
{
  "Tank Pressurization": [
    {
      "message": "Open Pressurant Fill",
      "delay": 0,
      "commands": ["CMD,Pressurant Fill,Open"]
    },
    {
      "message": "Wait for PT1 ≥ 50 psi",
      "delay": 0,
      "condition": {
        "sensor": "pt1",
        "min": 50,
        "timeoutMs": 60000
      },
      "commands": []
    }
  ]
}
```

**수정 방법**
1. `sequences.json` 파일 편집
2. 파일 저장 시 자동 검증 및 리로드
3. UI에서 즉시 변경사항 반영

### 시스템 설정 (`config.json`)

**주요 설정값**
```json
{
  "pressureLimit": 850,           // PSI, 압력 한계값
  "valveFeedbackTimeout": 2000,   // ms, 밸브 응답 대기시간
  "maxChartDataPoints": 100,      // 차트 표시 데이터 포인트
  "serial": {
    "baudRate": 115200             // Arduino 통신 속도
  }
}
```

**밸브 매핑**
- `valveMappings`: UI 밸브 이름 → Arduino 서보 인덱스
- `initialValves`: 앱 시작시 밸브 초기 상태

---

### 📡 통신 프로토콜 (상세)

#### 시리얼 통신 설정
- **포트**: USB 가상 COM 포트 (Arduino Mega)
- **속도**: 115,200 bps
- **데이터 비트**: 8
- **패리티**: 없음
- **정지 비트**: 1
- **흐름 제어**: 없음
- **타임아웃**: 200ms (라인 버퍼링)

#### 연결 초기화 (핸드셰이크)

**1단계: PC → Arduino**
```
HELLO\n
```
또는
```
H\n
```

**2단계: Arduino → PC**
```
READY\n
```

**3단계: 연결 확인**
- 핸드셰이크 성공 후 Arduino는 100ms 주기로 센서 데이터 전송 시작
- PC는 연결 상태를 `connected`로 설정
- 타임아웃: 3초 (응답 없으면 연결 실패)

#### Arduino → PC (센서 데이터 스트림)

**데이터 포맷 (CSV)**
```
pt1:123.45,pt2:67.89,pt3:45.23,pt4:78.90,flow1:0.125,flow2:0.087,tc1:298.15,tc2:305.42,V0_LS_OPEN:1,V0_LS_CLOSED:0,V1_LS_OPEN:0,V1_LS_CLOSED:1,V2_LS_OPEN:1,V2_LS_CLOSED:0,V3_LS_OPEN:0,V3_LS_CLOSED:1,V4_LS_OPEN:1,V4_LS_CLOSED:0,V5_LS_OPEN:0,V5_LS_CLOSED:1,V6_LS_OPEN:1,V6_LS_CLOSED:0\n
```

**필드 설명**
- `pt1~pt4`: 압력값 (PSI, float)
- `flow1~flow2`: 유량값 (m³/h, float)  
- `tc1~tc2`: 온도값 (°C, float)
- `V{n}_LS_OPEN`: 밸브 n번 열림 리미트 스위치 (1=눌림, 0=안눌림)
- `V{n}_LS_CLOSED`: 밸브 n번 닫힘 리미트 스위치 (1=눌림, 0=안눌림)

**전송 주기**: 100ms (10Hz)
**오류 처리**: 센서 읽기 실패시 이전값 유지 또는 NaN

#### PC → Arduino (제어 명령)

**1. 밸브 제어 (이름 기반)**
```
CMD,{valve_name},{action}\n
```

**예시:**
```
CMD,Ethanol Main,Open\n
CMD,N2O Main,Close\n
CMD,System Vent,Open\n
```

**유효한 밸브 이름:**
- `Ethanol Main`, `N2O Main`
- `Ethanol Purge`, `N2O Purge`  
- `Pressurant Fill`, `System Vent`
- `Igniter Fuel`

**유효한 액션:**
- `Open`: 밸브 열기
- `Close`: 밸브 닫기

**2. 밸브 제어 (인덱스 기반)**
```
V,{servo_index},{O|C}\n
```

**예시:**
```
V,0,O    # 서보 0번 열기
V,1,C    # 서보 1번 닫기
```

**서보 인덱스 매핑:**
- 0: Ethanol Main
- 1: N2O Main  
- 2: Ethanol Purge
- 3: N2O Purge
- 4: Pressurant Fill
- 5: System Vent
- 6: Igniter Fuel

#### 오류 응답 및 처리

**Arduino → PC 오류 메시지**
```
ERROR: Invalid command\n
ERROR: Unknown valve name\n
ERROR: Servo index out of range\n
```

**통신 오류 감지**
- **PC측**: 5초간 데이터 수신 없으면 연결 끊김으로 판단
- **Arduino측**: 명령 파싱 실패시 ERROR 응답

#### 데이터 파싱 (PC측)

**JavaScript 파싱 예시:**
```javascript
function parseSensorData(dataString) {
  const data = {};
  const pairs = dataString.split(',');
  
  pairs.forEach(pair => {
    const [key, value] = pair.split(':');
    if (key && value !== undefined) {
      data[key] = parseFloat(value) || 0;
    }
  });
  
  return data;
}
```

**타입 안전 처리 (TypeScript):**
```typescript
interface SensorData {
  pt1: number; pt2: number; pt3: number; pt4: number;
  flow1: number; flow2: number;
  tc1: number; tc2: number;
  V0_LS_OPEN: number; V0_LS_CLOSED: number;
  // ... 추가 리미트 스위치
}
```

---

## 📻 API 문서 및 IPC 인터페이스

### Electron IPC 아키텍처

GoRocket GUI는 Electron의 메인 프로세스와 렌더러 프로세스 간 안전한 통신을 위해 IPC(Inter-Process Communication)를 사용합니다.

**보안 모델:**
- `nodeIntegration: false` - 렌더러에서 Node.js API 직접 접근 금지
- `contextIsolation: true` - 실행 컨텍스트 분리 보안
- `sandbox: true` - 렌더러 프로세스 샌드박스 활성화
- `preload.ts` - 안전한 API 브릿지 역할

### 주요 IPC 채널

#### 시리얼 통신 API

**포트 관리**
```typescript
// 사용 가능한 시리얼 포트 목록 조회
api.getSerialPorts(): Promise<string[]>

// 예시 사용법
const ports = await window.electronAPI.getSerialPorts();
console.log('사용가능 포트:', ports); // ['COM3', 'COM4', ...]
```

**연결 관리**
```typescript
// Arduino에 연결
api.connectSerial(portName: string): Promise<boolean>

// Arduino 연결 해제  
api.disconnectSerial(): Promise<boolean>

// 예시 사용법
const success = await window.electronAPI.connectSerial('COM3');
if (success) {
  console.log('연결 성공');
} else {
  console.log('연결 실패');
}
```

**데이터 송수신**
```typescript
// Arduino로 명령 전송
api.sendToSerial(data: SerialCommand): Promise<boolean>

// Arduino로부터 데이터 수신 이벤트 등록
api.onSerialData(callback: (data: string) => void): () => void

// 예시 사용법
// 1. 밸브 제어 명령
const valveCommand: ValveSerialCommand = {
  type: 'V',
  servoIndex: 0,  // Ethanol Main
  action: ValveCommandType.OPEN
};
await window.electronAPI.sendToSerial(valveCommand);

// 2. 원시 명령 전송
const rawCommand: RawSerialCommand = {
  type: 'RAW',
  payload: 'CMD,Ethanol Main,Open'
};
await window.electronAPI.sendToSerial(rawCommand);

// 3. 데이터 수신
const unsubscribe = window.electronAPI.onSerialData((data) => {
  console.log('센서 데이터:', data);
  // pt1:123.45,pt2:67.89,flow1:0.125,tc1:298.15,...
});

// 4. 이벤트 리스너 제거
unsubscribe();
```

#### 설정 및 시스템 API

**설정 관리**
```typescript
// 애플리케이션 설정 로드
api.getConfig(): Promise<AppConfig>

// 예시 사용법
const config = await window.electronAPI.getConfig();
console.log('압력 한계값:', config.pressureLimit); // 850
console.log('밸브 매핑:', config.valveMappings);
```

**시스템 상태**
```typescript
// 연결 상태 변경 이벤트
api.onConnectionChange(callback: (connected: boolean) => void): () => void

// 시스템 오류 이벤트
api.onError(callback: (error: string) => void): () => void

// 예시 사용법
window.electronAPI.onConnectionChange((connected) => {
  if (connected) {
    console.log('Arduino 연결됨');
  } else {
    console.log('Arduino 연결 끊어짐');
  }
});

window.electronAPI.onError((error) => {
  console.error('시스템 오류:', error);
});
```

#### 데이터 로깅 API

**로깅 제어**
```typescript
// 로깅 시작
api.startLogging(): Promise<string>  // CSV 파일 경로 반환

// 로깅 중지
api.stopLogging(): Promise<boolean>

// 로깅 상태 변경 이벤트
api.onLoggingChange(callback: (isLogging: boolean, filePath?: string) => void): () => void

// 예시 사용법
const logFilePath = await window.electronAPI.startLogging();
console.log('로깅 시작:', logFilePath);
// Documents/rocket-logs/rocket-test-2025-08-11-14-30-25.csv

const stopped = await window.electronAPI.stopLogging();
console.log('로깅 중지:', stopped);
```

#### 시퀀스 API

**시퀀스 관리**
```typescript
// 사용 가능한 시퀀스 목록 조회
api.getSequences(): Promise<SequencesPayload>

// 시퀀스 실행 요청
api.runSequence(sequenceName: string): Promise<boolean>

// 시퀀스 중지 요청
api.stopSequence(): Promise<boolean>

// 시퀀스 업데이트 이벤트
api.onSequencesUpdated(callback: (payload: SequencesPayload) => void): () => void

// 예시 사용법
const { sequences, result } = await window.electronAPI.getSequences();
console.log('사용가능 시퀀스:', Object.keys(sequences));
// ['Pre-Test Purge', 'Tank Pressurization', ...]

// 시퀀스 실행
const started = await window.electronAPI.runSequence('Pre-Test Purge');
if (started) {
  console.log('시퀀스 시작됨');
}
```

### TypeScript 타입 정의

**주요 데이터 타입**
```typescript
// 센서 데이터 구조
interface SensorData {
  pt1: number;    // 압력 센서 1 (PSI)
  pt2: number;    // 압력 센서 2 (PSI)
  pt3: number;    // 압력 센서 3 (PSI)
  pt4: number;    // 압력 센서 4 (PSI)
  flow1: number;  // 유량 센서 1 (m³/h)
  flow2: number;  // 유량 센서 2 (m³/h)
  tc1: number | string;  // 온도 센서 1 (°C)
  tc2: number | string;  // 온도 센서 2 (°C)
  timestamp: number;     // 타임스탬프
}

// 밸브 상태
type ValveState = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'ERROR' | 'STUCK';

// 밸브 정보
interface Valve {
  id: number;
  name: string;
  state: ValveState;
  lsOpen: boolean;   // 열림 리미트 스위치
  lsClosed: boolean; // 닫힘 리미트 스위치
}

// 시리얼 명령 타입
type SerialCommand = ValveSerialCommand | RawSerialCommand;

interface ValveSerialCommand {
  type: 'V';
  servoIndex: number;
  action: 'OPEN' | 'CLOSE';
}

interface RawSerialCommand {
  type: 'RAW';
  payload: string;
}

// 애플리케이션 설정
interface AppConfig {
  serial: {
    baudRate: number;  // 115200
  };
  valveMappings: Record<string, { servoIndex: number }>;
  maxChartDataPoints: number;    // 100
  pressureLimit: number;         // 850 PSI
  valveFeedbackTimeout: number;  // 2000ms
  initialValves: Valve[];
}
```

### 오류 처리 및 디버깅

**IPC 오류 처리**
```typescript
try {
  const result = await window.electronAPI.connectSerial('COM3');
  if (!result) {
    throw new Error('연결 실패');
  }
} catch (error) {
  console.error('IPC 오류:', error.message);
  // 오류 유형:
  // - 'invalid port': 비정상 포트명
  // - 'invalid command': 잘못된 명령 형식
  // - 네트워크/하드웨어 오류
}
```

**디버깅 팁**
```javascript
// 1. Electron DevTools에서 IPC 메시지 모니터링
window.electronAPI.onSerialData((data) => {
  console.log('[DEBUG] Serial Data:', data);
});

// 2. 메인 프로세스 로그 (터미널 출력)
console.log('로그를 확인하세요');

// 3. IPC 통신 테스트
async function testIPC() {
  try {
    const ports = await window.electronAPI.getSerialPorts();
    console.log('포트 조회 성공:', ports);
    
    const config = await window.electronAPI.getConfig();
    console.log('설정 로드 성공:', config.pressureLimit);
  } catch (e) {
    console.error('IPC 테스트 실패:', e);
  }
}
```

### 보안 고려사항

**입력 검증**
- 모든 IPC 메시지는 `preload.ts`에서 엄격한 입력 검증 수행
- 포트명 정규식 검증: `/^[\w\-:/\\.]{1,128}$/`
- 명령 객체 구조 및 타입 검증

**권한 분리**
- 렌더러 프로세스는 Node.js API 직접 접근 불가
- 모든 시스템 작업은 메인 프로세스에서 수행
- 샌드박스 모드로 렌더러 보안 강화

---

## 🛠️ 문제 해결

### 일반적인 문제

**serialport 모듈 빌드 실패**
```bash
# Windows (관리자 권한 필요)
npm install -g windows-build-tools
npm run rebuild

# macOS/Linux
npm run rebuild
```

**Arduino 연결 실패**
- USB 케이블 및 드라이버 확인
- 다른 프로그램에서 포트 사용 여부 확인
- Arduino IDE에서 시리얼 모니터 닫기
- 보드 재시작 (리셋 버튼)

**시퀀스 검증 실패**
```bash
# 시퀀스 파일 검증
npm run validate:seq

# 스키마 오류 확인 및 수정
```

**센서 데이터 수신 안됨**
- Arduino 펌웨어 업로드 상태 확인
- 시리얼 통신 속도 일치 확인 (115200 bps)
- 센서 하드웨어 연결 점검

### 개발 모드 디버깅

**Electron DevTools**
- `Ctrl+Shift+I` (Windows/Linux)
- `Cmd+Option+I` (macOS)

**로그 확인**
- 브라우저 콘솔: Frontend 로그
- Electron 메인 프로세스: 터미널 출력
- Arduino: 시리얼 모니터 (115200 bps)

---

## 🚀 실제 테스트 시나리오 및 예제

### 전체 시스템 테스트 절차

#### 1단계: 하드웨어 준비 및 검증

**Arduino 및 센서 체크리스트**
- [ ] Arduino Mega 2560 USB 연결 확인
- [ ] 압력센서 4개 (PT1-PT4) 연결 및 상태 확인
- [ ] 온도센서 2개 (TC1-TC2) MAX6675 모듈 SPI 연결
- [ ] 유량센서 2개 (Flow1-Flow2) 디지털 입력 확인
- [ ] 서보모터 7개 PWM 연결 및 기본 위치 설정
- [ ] 리미트스위치 14개 (Open/Close 쌍) Pull-up 연결

**전원 및 전압 체크**
```bash
# Arduino IDE 시리얼 모니터로 확인
1. Tools > Serial Monitor (115200 bps)
2. 예상 출력: "BOOT" -> "READY"
3. 100ms 주기로 센서 데이터 수신 확인
```

#### 2단계: 소프트웨어 설정 및 연결 테스트

**개발 환경 실행**
```bash
# 1. 의존성 설치
npm install
npm run rebuild  # serialport 네이티브 모듈 빌드

# 2. 설정 파일 확인
code config.json  # 압력 한계, 밸브 매핑 등 확인

# 3. 시퀀스 유효성 검사
npm run validate:seq
# 예상 출력: "AJV_OK true"

# 4. 애플리케이션 실행
npm run dev
```

**연결 테스트**
1. GUI에서 포트 선택 (COM3, /dev/ttyUSB0 등)
2. "연결" 버튼 클릭
3. 헤더에서 연결 상태 확인 (초록등 표시)
4. 센서 패널에서 데이터 수신 확인

#### 3단계: 개별 센서 및 밸브 기능 테스트

**센서 데이터 검증**
```javascript
// 브라우저 DevTools 콘솔에서 실행
// 1. 센서 데이터 모니터링
window.electronAPI.onSerialData((data) => {
  const parsed = data.split(',').reduce((acc, pair) => {
    const [key, value] = pair.split(':');
    acc[key] = parseFloat(value) || 0;
    return acc;
  }, {});
  
  console.log('Pressure:', parsed.pt1, parsed.pt2, parsed.pt3, parsed.pt4);
  console.log('Flow:', parsed.flow1, parsed.flow2);
  console.log('Temperature:', parsed.tc1, parsed.tc2);
});

// 2. 예상 범위 확인
// - 압력: 0-100 PSI (대기압 상태)
// - 유량: 0 m³/h (정지 상태)
// - 온도: 20-30°C (실내 온도)
```

**밸브 제어 테스트**
```javascript
// 1. 개별 밸브 수동 제어
const testValve = async (valveName) => {
  console.log(`테스트: ${valveName}`);
  
  // 밸브 열기
  const openCmd = { type: 'RAW', payload: `CMD,${valveName},Open` };
  await window.electronAPI.sendToSerial(openCmd);
  
  // 3초 대기 후 상태 확인
  setTimeout(async () => {
    console.log(`${valveName} 열림 상태 확인`);
    
    // 밸브 닫기
    const closeCmd = { type: 'RAW', payload: `CMD,${valveName},Close` };
    await window.electronAPI.sendToSerial(closeCmd);
    
    setTimeout(() => {
      console.log(`${valveName} 닫힘 상태 확인`);
    }, 3000);
  }, 3000);
};

// 2. 모든 밸브 순차 테스트
const valveNames = ['Ethanol Main', 'N2O Main', 'Ethanol Purge', 'N2O Purge', 'Pressurant Fill', 'System Vent', 'Igniter Fuel'];
for (const valve of valveNames) {
  await testValve(valve);
  await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 간격
}
```

#### 4단계: 자동 시퀀스 테스트

**안전한 시퀀스 실행 순서**
1. **Pre-Test Purge** (가장 안전)
2. **Tank Pressurization** (압력 센서 모니터링 중요)
3. **Safe Vent** (비상 상황에서도 안전)
4. **Engine Chill & Pre-Flow** (수동 감시 필수)
5. **Igniter Arm** (반드시 전문가 입회 하에)

**시퀀스 실행 예제**
```javascript
// 1. Pre-Test Purge 시퀀스 테스트
const runTestSequence = async () => {
  console.log('테스트 시퀀스 시작: Pre-Test Purge');
  
  try {
    const result = await window.electronAPI.runSequence('Pre-Test Purge');
    if (result) {
      console.log('시퀀스 시작 성공');
    } else {
      console.error('시퀀스 시작 실패');
    }
  } catch (error) {
    console.error('시퀀스 오류:', error);
  }
};

// 2. 시퀀스 중단 테스트 (비상 상황 대비)
const testEmergencyStop = async () => {
  console.log('비상 정지 테스트');
  
  // 시퀀스 시작
  await window.electronAPI.runSequence('Tank Pressurization');
  
  // 5초 후 비상 정지
  setTimeout(async () => {
    const stopped = await window.electronAPI.stopSequence();
    console.log('비상 정지 결과:', stopped);
  }, 5000);
};
```

#### 5단계: 데이터 로깅 및 백업 테스트

**로깅 기능 검증**
```javascript
// 1. 로깅 시작
const testLogging = async () => {
  const logFile = await window.electronAPI.startLogging();
  console.log('로깅 파일:', logFile);
  
  // 30초간 데이터 수집
  setTimeout(async () => {
    const stopped = await window.electronAPI.stopLogging();
    console.log('로깅 중지:', stopped);
    
    // 파일 내용 확인
    console.log(`로깅 파일을 확인하세요: ${logFile}`);
  }, 30000);
};

// 2. 예상 CSV 형식
// timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1,tc2,V0_LS_OPEN,V0_LS_CLOSED,...
// 2025-08-11T14:30:25.123Z,45.2,67.8,23.1,89.4,0.0,0.0,25.3,26.1,0,1,...
```

### 성능 벤치마크 및 테스트

**시스템 리소스 모니터링**
```javascript
// CPU 및 메모리 사용량 모니터링
const monitorPerformance = () => {
  const start = performance.now();
  let dataCount = 0;
  
  window.electronAPI.onSerialData((data) => {
    dataCount++;
    if (dataCount % 100 === 0) { // 10초마다 (100ms * 100)
      const elapsed = performance.now() - start;
      const fps = (dataCount / elapsed) * 1000;
      console.log(`데이터 수신 속도: ${fps.toFixed(2)} Hz`);
      console.log(`총 데이터 수: ${dataCount}`);
    }
  });
};

// 예상 성능
// - 데이터 수신: 10 Hz (±0.1 Hz)
// - 메모리 사용량: < 200MB
// - CPU 사용량: < 10%
```

**스트레스 테스트**
```javascript
// 장시간 연속 작동 테스트
const stressTest = async () => {
  console.log('8시간 연속 작동 테스트 시작');
  
  // 로깅 시작
  await window.electronAPI.startLogging();
  
  // 주기적 밸브 테스트 (10분마다)
  const valveTest = setInterval(async () => {
    await window.electronAPI.runSequence('Pre-Test Purge');
  }, 600000);
  
  // 8시간 후 종료
  setTimeout(() => {
    clearInterval(valveTest);
    window.electronAPI.stopLogging();
    console.log('스트레스 테스트 완료');
  }, 8 * 60 * 60 * 1000);
};
```

### 고급 사용법 및 커스터마이징

#### 사용자 정의 시퀀스 생성

**예제: 연료 시스템 단위 테스트**
```json
// sequences.json에 추가
{
  "Fuel System Test": [
    {
      "message": "Ensure all fuel valves closed",
      "delay": 0,
      "commands": ["CMD,Ethanol Main,Close", "CMD,Ethanol Purge,Close"]
    },
    {
      "message": "Open Ethanol Main for 5 seconds",
      "delay": 0,
      "commands": ["CMD,Ethanol Main,Open"]
    },
    {
      "message": "Wait for pressure stabilization",
      "delay": 5000,
      "commands": []
    },
    {
      "message": "Close Ethanol Main",
      "delay": 0,
      "commands": ["CMD,Ethanol Main,Close"]
    },
    {
      "message": "Verify PT3 < 5 PSI",
      "delay": 0,
      "condition": {
        "sensor": "pt3",
        "max": 5,
        "op": "lte",
        "timeoutMs": 15000
      },
      "commands": []
    }
  ]
}
```

**동적 시퀀스 로드**
```javascript
// 시퀀스 파일 수정 후 자동 업데이트
window.electronAPI.onSequencesUpdated((payload) => {
  const { sequences, result } = payload;
  
  if (result.valid) {
    console.log('새 시퀀스 로드됨:', Object.keys(sequences));
  } else {
    console.error('시퀀스 오류:', result.errors);
  }
});
```

#### 센서 데이터 후처리

**사용자 정의 모니터링 위젯**
```javascript
// 전용 모니터링 위젯 생성
class CustomMonitor {
  constructor() {
    this.history = [];
    this.alerts = [];
  }
  
  processData(sensorData) {
    // 1. 데이터 저장
    this.history.push({
      ...sensorData,
      timestamp: Date.now()
    });
    
    // 2. 이동평균 계산 (10초)
    const recent = this.history.filter(d => 
      Date.now() - d.timestamp < 10000
    );
    
    const avgPressure = recent.reduce((sum, d) => 
      sum + d.pt1, 0) / recent.length;
    
    // 3. 알람 조건 확인
    if (avgPressure > 80) {
      this.alerts.push({
        type: 'HIGH_PRESSURE',
        message: `평균 압력 경고: ${avgPressure.toFixed(1)} PSI`,
        timestamp: Date.now()
      });
    }
    
    return {
      current: sensorData,
      average: { pt1: avgPressure },
      alerts: this.alerts.slice(-10) // 최근 10개
    };
  }
}

const monitor = new CustomMonitor();
window.electronAPI.onSerialData((data) => {
  const parsed = parseSensorData(data);
  const analysis = monitor.processData(parsed);
  console.log('분석 결과:', analysis);
});
```

#### 모바일 모니터링 (원격 접속)

**웹 대시보드 구성**
```javascript
// Express.js 서버 추가 (옵션)
const express = require('express');
const app = express();
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// 실시간 데이터 전송
window.electronAPI.onSerialData((data) => {
  const message = JSON.stringify({
    type: 'sensor_data',
    data: data,
    timestamp: Date.now()
  });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

// 모바일 웹에서 접속
// ws://your-computer-ip:8080
```

---

## ⚡ 성능 최적화 및 모니터링

### 시스템 성능 벤치마크

**하드웨어 요구사항**
- **최소 사양**
  - CPU: Intel i3-8100 / AMD Ryzen 3 2200G 또는 동급
  - RAM: 8GB DDR4
  - 저장공간: 2GB 여유 공간
  - USB: 2.0 이상 (Arduino 연결용)

- **권장 사양**
  - CPU: Intel i5-10400 / AMD Ryzen 5 3600 또는 동급
  - RAM: 16GB DDR4
  - 저장공간: 10GB 여유 공간 (로깅용)
  - USB: 3.0 이상 (안정적인 데이터 전송)

**성능 지표**
```typescript
interface PerformanceMetrics {
  dataRate: number;        // Hz, 실시간 데이터 수신율
  memoryUsage: number;     // MB, 메모리 사용량
  cpuUsage: number;        // %, CPU 사용률
  responseTime: number;    // ms, 명령 응답 시간
  uiFrameRate: number;     // FPS, UI 렌더링 속도
}

// 예상 성능 기준
const expectedPerformance: PerformanceMetrics = {
  dataRate: 10,           // 10Hz ±0.5Hz
  memoryUsage: 150,       // 150MB 이하
  cpuUsage: 8,           // 8% 이하
  responseTime: 100,      // 100ms 이하
  uiFrameRate: 60        // 60FPS
};
```

### 메모리 최적화

**데이터 캐시 관리**
```typescript
// 순환 버퍼를 이용한 센서 데이터 관리
class CircularBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private size = 0;
  
  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }
  
  push(item: T): void {
    this.buffer[this.tail] = item;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
    this.tail = (this.tail + 1) % this.capacity;
  }
  
  getRecent(count: number): T[] {
    const result: T[] = [];
    const actualCount = Math.min(count, this.size);
    
    for (let i = 0; i < actualCount; i++) {
      const index = (this.tail - 1 - i + this.capacity) % this.capacity;
      result.unshift(this.buffer[index]);
    }
    
    return result;
  }
}

// 사용 예시
const sensorBuffer = new CircularBuffer<SensorData>(1000); // 최대 1000개 보관
```

**차트 데이터 최적화**
```typescript
// Recharts 성능 최적화
const OptimizedChart = React.memo(({ data }: { data: SensorData[] }) => {
  const throttledData = useMemo(() => {
    // 100개 이상일 때 5개씩 건너뛰어 표시
    return data.length > 100 
      ? data.filter((_, index) => index % 5 === 0)
      : data;
  }, [data]);
  
  return (
    <LineChart data={throttledData}>
      {/* 차트 구성 요소 */}
    </LineChart>
  );
});
```

### CPU 최적화

**워커 스레드 활용**
```typescript
// worker.ts - 데이터 처리 전용 워커
self.onmessage = (event) => {
  const { sensorData, config } = event.data;
  
  // 무거운 계산 작업 (이동평균, 필터링 등)
  const processedData = sensorData.map(data => ({
    ...data,
    movingAverage: calculateMovingAverage(data),
    filtered: applyKalmanFilter(data),
    anomaly: detectAnomaly(data, config.thresholds)
  }));
  
  self.postMessage({ processedData });
};

// main thread
const dataWorker = new Worker('worker.js');
dataWorker.postMessage({ sensorData, config });
dataWorker.onmessage = (event) => {
  const { processedData } = event.data;
  updateUI(processedData);
};
```

**렌더링 최적화**
```typescript
// React 컴포넌트 최적화
const SensorPanel = React.memo(({ sensors }: { sensors: SensorData }) => {
  const [displayData, setDisplayData] = useState(sensors);
  
  // 100ms마다만 UI 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayData(sensors);
    }, 100);
    
    return () => clearInterval(timer);
  }, [sensors]);
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(displayData).map(([key, value]) => (
        <SensorCard key={key} name={key} value={value} />
      ))}
    </div>
  );
});
```

### 네트워크 및 I/O 최적화

**시리얼 통신 버퍼링**
```typescript
class OptimizedSerialManager {
  private commandQueue: SerialCommand[] = [];
  private processing = false;
  private batchSize = 10;
  
  async sendCommand(command: SerialCommand): Promise<void> {
    this.commandQueue.push(command);
    
    if (!this.processing) {
      this.processBatch();
    }
  }
  
  private async processBatch(): Promise<void> {
    this.processing = true;
    
    while (this.commandQueue.length > 0) {
      const batch = this.commandQueue.splice(0, this.batchSize);
      
      // 배치로 명령 전송
      for (const command of batch) {
        await this.serialPort.write(command);
        await this.delay(10); // 10ms 간격
      }
    }
    
    this.processing = false;
  }
}
```

**로그 파일 압축**
```typescript
import { createGzip } from 'zlib';
import { pipeline } from 'stream';

class CompressedLogger {
  private gzipStream = createGzip();
  
  async startLogging(filePath: string): Promise<void> {
    const writeStream = fs.createWriteStream(`${filePath}.gz`);
    
    pipeline(
      this.gzipStream,
      writeStream,
      (err) => {
        if (err) console.error('압축 오류:', err);
      }
    );
  }
  
  log(data: string): void {
    this.gzipStream.write(data);
  }
}
```

### 실시간 모니터링 도구

**시스템 메트릭 수집**
```typescript
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  
  startMonitoring(): void {
    setInterval(() => {
      const metric: PerformanceMetrics = {
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: process.cpuUsage().user / 1000,
        dataRate: this.calculateDataRate(),
        responseTime: this.measureResponseTime(),
        uiFrameRate: this.measureFrameRate()
      };
      
      this.metrics.push(metric);
      this.checkThresholds(metric);
    }, 1000);
  }
  
  private checkThresholds(metric: PerformanceMetrics): void {
    if (metric.memoryUsage > 200) {
      console.warn('높은 메모리 사용량:', metric.memoryUsage, 'MB');
    }
    
    if (metric.dataRate < 9.5) {
      console.warn('낮은 데이터 수신율:', metric.dataRate, 'Hz');
    }
  }
}
```

**성능 대시보드**
```javascript
// DevTools 콘솔에서 실행 가능한 성능 모니터
const performanceMonitor = {
  start() {
    this.startTime = performance.now();
    this.dataCount = 0;
    this.memoryBaseline = performance.memory?.usedJSHeapSize || 0;
    
    // 데이터 수신 모니터링
    window.electronAPI.onSerialData(() => {
      this.dataCount++;
    });
    
    // 5초마다 리포트
    this.interval = setInterval(() => {
      this.report();
    }, 5000);
  },
  
  report() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    const dataRate = this.dataCount / elapsed;
    const memoryUsed = (performance.memory?.usedJSHeapSize || 0) - this.memoryBaseline;
    
    console.log('=== Performance Report ===');
    console.log(`Data Rate: ${dataRate.toFixed(2)} Hz`);
    console.log(`Memory Delta: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total Data Points: ${this.dataCount}`);
    console.log('========================');
  },
  
  stop() {
    clearInterval(this.interval);
  }
};

// 사용법
performanceMonitor.start();
// ... 테스트 실행 ...
// performanceMonitor.stop();
```

---

## 🔒 보안 가이드라인 및 안전 절차

### 물리적 안전 조치

**하드웨어 안전 체크리스트**
- [ ] **전원 안전성**
  - 모든 전원 연결 확인 (단락 방지)
  - 접지 연결 상태 점검
  - 과전압 보호 장치 설치

- [ ] **기계적 안전성**
  - 서보 모터 물리적 제한 장치 설치
  - 밸브 최대 토크 설정
  - 긴급 수동 차단 밸브 준비

- [ ] **압력 시스템 안전**
  - 압력 릴리프 밸브 설치 (900 PSI)
  - 압력 센서 교정 및 검증
  - 배관 누출 점검

- [ ] **화재/폭발 방지**
  - 가연성 가스 누출 감지기
  - 적절한 환기 시스템
  - 소화 장비 비치

### 소프트웨어 보안

**접근 제어**
```typescript
// 사용자 권한 레벨 정의
enum UserRole {
  OBSERVER = 1,    // 센서 데이터 보기만
  OPERATOR = 2,    // 기본 밸브 제어
  ENGINEER = 3,    // 시퀀스 실행
  ADMIN = 4       // 시스템 설정 변경
}

interface SecurityContext {
  userId: string;
  role: UserRole;
  sessionToken: string;
  lastActivity: number;
}

class SecurityManager {
  private currentUser: SecurityContext | null = null;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30분
  
  authenticate(userId: string, password: string): boolean {
    // 실제 환경에서는 암호화된 패스워드 검증
    const isValid = this.validateCredentials(userId, password);
    
    if (isValid) {
      this.currentUser = {
        userId,
        role: this.getUserRole(userId),
        sessionToken: this.generateToken(),
        lastActivity: Date.now()
      };
    }
    
    return isValid;
  }
  
  hasPermission(requiredRole: UserRole): boolean {
    if (!this.currentUser) return false;
    
    // 세션 타임아웃 확인
    const now = Date.now();
    if (now - this.currentUser.lastActivity > this.SESSION_TIMEOUT) {
      this.logout();
      return false;
    }
    
    this.currentUser.lastActivity = now;
    return this.currentUser.role >= requiredRole;
  }
}
```

**명령어 검증 및 로깅**
```typescript
class SecureCommandProcessor {
  private commandHistory: CommandLog[] = [];
  
  async executeCommand(command: SerialCommand, user: SecurityContext): Promise<boolean> {
    // 1. 권한 확인
    if (!this.hasCommandPermission(command, user.role)) {
      this.logSecurityEvent('UNAUTHORIZED_COMMAND', user, command);
      throw new Error('권한이 부족합니다');
    }
    
    // 2. 명령어 유효성 검사
    if (!this.validateCommand(command)) {
      this.logSecurityEvent('INVALID_COMMAND', user, command);
      throw new Error('유효하지 않은 명령입니다');
    }
    
    // 3. 위험 상황 확인
    if (this.isHighRiskCommand(command)) {
      const confirmation = await this.requireConfirmation(user);
      if (!confirmation) {
        return false;
      }
    }
    
    // 4. 명령 실행 및 로깅
    const result = await this.serialManager.send(command);
    
    this.commandHistory.push({
      timestamp: Date.now(),
      user: user.userId,
      command,
      result,
      riskLevel: this.assessRiskLevel(command)
    });
    
    return result;
  }
  
  private isHighRiskCommand(command: SerialCommand): boolean {
    if (command.type === 'RAW') {
      const dangerous = [
        'Ethanol Main',
        'N2O Main',
        'Igniter Fuel'
      ];
      return dangerous.some(valve => 
        command.payload.includes(valve) && 
        command.payload.includes('Open')
      );
    }
    return false;
  }
}
```

### 네트워크 보안

**통신 암호화**
```typescript
import crypto from 'crypto';

class SecureCommunication {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';
  
  constructor(key: string) {
    this.encryptionKey = crypto.createHash('sha256').update(key).digest();
  }
  
  encrypt(data: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('rocket-control', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('rocket-control', 'utf8'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 감사 및 로깅

**보안 이벤트 로깅**
```typescript
enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  UNAUTHORIZED_COMMAND = 'UNAUTHORIZED_COMMAND',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  EMERGENCY_STOP = 'EMERGENCY_STOP'
}

interface SecurityEvent {
  timestamp: number;
  type: SecurityEventType;
  userId?: string;
  details: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class SecurityAuditor {
  private events: SecurityEvent[] = [];
  
  logEvent(type: SecurityEventType, details: any, severity = 'MEDIUM'): void {
    const event: SecurityEvent = {
      timestamp: Date.now(),
      type,
      userId: this.getCurrentUserId(),
      details,
      severity
    };
    
    this.events.push(event);
    
    // 중요 이벤트는 즉시 알림
    if (severity === 'CRITICAL') {
      this.sendAlert(event);
    }
    
    // 영구 저장
    this.persistToFile(event);
  }
  
  private sendAlert(event: SecurityEvent): void {
    // 이메일, SMS, 시스템 알림 등
    console.error(`CRITICAL SECURITY EVENT: ${event.type}`, event.details);
    
    // 자동 시스템 셧다운 (필요시)
    if (event.type === SecurityEventType.UNAUTHORIZED_COMMAND) {
      this.initiateEmergencyShutdown();
    }
  }
}
```

### 비상 절차

**긴급 정지 프로토콜**
```typescript
class EmergencyProtocol {
  private emergencyStopActivated = false;
  
  async initiateEmergencyStop(reason: string): Promise<void> {
    if (this.emergencyStopActivated) return;
    
    this.emergencyStopActivated = true;
    
    console.error(`EMERGENCY STOP INITIATED: ${reason}`);
    
    try {
      // 1. 모든 연료 밸브 즉시 차단
      await Promise.all([
        this.closeValve('Ethanol Main'),
        this.closeValve('N2O Main'),
        this.closeValve('Igniter Fuel'),
        this.closeValve('Pressurant Fill')
      ]);
      
      // 2. 안전 벤트 밸브 개방
      await this.openValve('System Vent');
      
      // 3. 퍼지 밸브 개방 (라인 청소)
      await Promise.all([
        this.openValve('Ethanol Purge'),
        this.openValve('N2O Purge')
      ]);
      
      // 4. 로그 기록
      this.securityAuditor.logEvent(
        SecurityEventType.EMERGENCY_STOP,
        { reason, timestamp: Date.now() },
        'CRITICAL'
      );
      
      // 5. 사용자 알림
      this.notifyOperators('긴급 정지가 실행되었습니다: ' + reason);
      
    } catch (error) {
      console.error('긴급 정지 실행 중 오류:', error);
      // 하드웨어 레벨 정지 신호 전송
      this.activateHardwareEmergencyStop();
    }
  }
  
  async resetAfterEmergency(): Promise<boolean> {
    // 안전 체크리스트 확인 후에만 리셋 허용
    const safetyChecks = [
      this.verifyPressureSafe(),
      this.verifyTemperatureSafe(),
      this.verifyAllValvesClosed(),
      this.verifyNoLeaks()
    ];
    
    const allSafe = await Promise.all(safetyChecks);
    
    if (allSafe.every(check => check)) {
      this.emergencyStopActivated = false;
      return true;
    }
    
    return false;
  }
}
```

**데이터 백업 및 복구**
```typescript
class DataBackupManager {
  private backupInterval: NodeJS.Timer;
  
  startAutoBackup(): void {
    // 매 시간마다 자동 백업
    this.backupInterval = setInterval(() => {
      this.createBackup();
    }, 60 * 60 * 1000);
  }
  
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(os.homedir(), 'rocket-backups', timestamp);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    // 설정 파일 백업
    await fs.copyFile('config.json', path.join(backupDir, 'config.json'));
    await fs.copyFile('sequences.json', path.join(backupDir, 'sequences.json'));
    
    // 로그 파일 백업
    const logDir = path.join(os.homedir(), 'Documents', 'rocket-logs');
    if (await fs.pathExists(logDir)) {
      await fs.copy(logDir, path.join(backupDir, 'logs'));
    }
    
    // 압축
    const archivePath = `${backupDir}.zip`;
    await this.createZipArchive(backupDir, archivePath);
    await fs.remove(backupDir);
    
    return archivePath;
  }
}
```

## 📞 지원 및 기여

**이슈 리포팅**
- [GitHub Issues](https://github.com/jungho1902/Gorocket-Control-System-GUI/issues)

**프로젝트 기여**
- Fork → Branch → Pull Request
- 코딩 스타일: ESLint + Prettier 설정 준수
- 타입 안전성: TypeScript strict 모드

**라이선스**
- 이 프로젝트의 라이선스 정보는 LICENSE 파일을 참조하세요.

---

*이 문서는 최신 코드베이스 분석을 바탕으로 작성되었습니다. (업데이트: 2025)*
