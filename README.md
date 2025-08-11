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
- Arduino Mega 2560 (펌웨어)
- MAX6675 온도센서 모듈
- 압력 센서, 유량 센서, 서보 모터

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

### 설치 과정

#### 1. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 복제
git clone https://github.com/jungho1902/Gorocket-Control-System-GUI.git
cd Gorocket-Control-System-GUI

# 의존성 설치
npm install

# 네이티브 모듈 재빌드 (serialport)
npm run rebuild
```

#### 2. Arduino 펌웨어 업로드

1. **Arduino IDE에서 펌웨어 열기**
   ```
   파일 > 열기 > arduino_mega_code/arduino_mega_code.ino
   ```

2. **보드 및 포트 설정**
   - 보드: `Arduino Mega or Mega 2560`
   - 포트: Arduino가 연결된 COM 포트 선택

3. **펌웨어 업로드**
   - 업로드 버튼 클릭 (→)
   - "Initialization complete" 메시지 확인

#### 3. 설정 파일 확인

**config.json 주요 설정**
```json
{
  "serial": { "baudRate": 115200 },
  "pressureLimit": 850,
  "valveFeedbackTimeout": 2000,
  "maxChartDataPoints": 100
}
```

**sequences.json 시퀀스 설정**
- 사전 정의된 6개 시퀀스
- JSON Schema 기반 검증
- 실시간 파일 변경 감지

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

### 통신 프로토콜

**Arduino → PC (센서 데이터)**
```
pt1:123.45,pt2:67.89,flow1:0.125,tc1:298.15,V0_LS_OPEN:1,V0_LS_CLOSED:0,...
```

**PC → Arduino (제어 명령)**
```
CMD,Valve_Name,Action  // 예: CMD,Ethanol Main,Open
V,ServoIndex,O|C       // 예: V,0,O (서보 0번 열기)
```

**핸드셰이크**
- PC → Arduino: `HELLO\n`
- Arduino → PC: `READY`
- 연결 성공 후 실시간 데이터 스트림 시작

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
