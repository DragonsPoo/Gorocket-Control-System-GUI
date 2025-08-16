# 🚀 GoRocket Control System GUI

> **Rocket Engine Test Control and Monitoring System**  
> Next.js + Electron 기반의 현대적인 로켓 지상 시험 제어 시스템

## 📦 기술 스택

### 프론트엔드
- **Next.js 15.3.3** - React 프레임워크 (Turbopack 사용)
- **React 18.3.1** - UI 라이브러리
- **TypeScript 5** - 타입 안전성
- **Tailwind CSS 3.4** - 스타일링
- **Radix UI** - 접근성 기반 UI 컴포넌트
- **Recharts** - 실시간 데이터 차트
- **Lucide React** - 아이콘 라이브러리

### 백엔드 (Electron Main Process)
- **Electron 37.2.3** - 데스크톱 애플리케이션 프레임워크
- **Node.js** - 런타임 환경
- **SerialPort** - 아두이노 통신
- **TypeScript** - 타입 안전성

### 하드웨어 통신
- **Arduino Mega** - 하드웨어 제어
- **USB Serial Communication** - PC ↔ Arduino 통신
- **JSON Protocol** - 명령 및 데이터 전송

## 🏗️ 프로젝트 구조

```
GoRocket-Control-System-GUI/
├── src/                          # Next.js 앱 소스
│   ├── app/                      # App Router 페이지
│   │   ├── page.tsx             # 메인 대시보드 페이지
│   │   ├── layout.tsx           # 루트 레이아웃
│   │   └── globals.css          # 전역 스타일
│   ├── components/              # React 컴포넌트
│   │   ├── dashboard/           # 대시보드 전용 컴포넌트
│   │   │   ├── header.tsx       # 상단 헤더 (연결, 포트 선택)
│   │   │   ├── sensor-panel.tsx # 센서 데이터 패널
│   │   │   ├── valve-display.tsx# 밸브 제어 패널
│   │   │   ├── sequence-panel.tsx# 시퀀스 제어 패널
│   │   │   ├── data-chart-panel.tsx# 실시간 차트
│   │   │   └── terminal-panel.tsx# 로그 터미널
│   │   └── ui/                  # 재사용 가능한 UI 컴포넌트
│   ├── hooks/                   # Custom React Hooks
│   │   ├── useSerialManager.ts  # 시리얼 통신 관리
│   │   ├── useSequenceManager.ts# 시퀀스 실행 관리
│   │   ├── useSensorData.ts     # 센서 데이터 관리
│   │   └── useValveControl.ts   # 밸브 제어 관리
│   └── lib/                     # 유틸리티 라이브러리
│       ├── utils.ts            # 공통 유틸리티
│       └── event-bus.ts        # 이벤트 버스
├── main/                        # Electron Main Process
│   ├── SerialManager.ts        # 시리얼 포트 관리
│   ├── SequenceEngine.ts       # 시퀀스 실행 엔진
│   ├── SequenceDataManager.ts  # 시퀀스 데이터 관리
│   ├── LogManager.ts           # 로깅 시스템
│   └── ConfigManager.ts        # 설정 관리
├── shared/                      # 공유 타입 및 유틸리티
│   ├── types/                  # TypeScript 타입 정의
│   └── utils/                  # 공유 유틸리티
├── arduino_mega_code/          # Arduino 펌웨어
│   └── arduino_mega_code.ino   # Arduino 메가 코드
├── main.ts                     # Electron 메인 프로세스
├── preload.ts                  # Electron Preload 스크립트
├── config.json                 # 시스템 설정
├── sequences.json              # 시퀀스 정의
└── sequences.schema.json       # 시퀀스 JSON 스키마
```

## ⚡ 시작하기

### 1. 개발 환경 설정

```bash
# 프로젝트 클론
git clone <repository-url>
cd Gorocket-Control-System-GUI

# 종속성 설치
npm install

# Electron 네이티브 모듈 재빌드 (serialport)
npm run rebuild

# 개발 서버 시작
npm run dev
```

### 2. 빌드 및 패키징

```bash
# 전체 빌드 (Electron + Next.js)
npm run build

# 실행 파일 생성
npm run package

# 타입 체크
npm run typecheck

# 린팅
npm run lint

# 시퀀스 스키마 검증
npm run validate:seq
```

### 3. 하드웨어 준비

#### 전원 시스템
- [ ] 주 전원 (24V) 연결 및 전압 확인
- [ ] 아두이노 메가 전원 LED 점등 확인
- [ ] 서보모터 전원 분배기 상태 확인
- [ ] 센서 전원 공급 상태 확인 (5V, 3.3V)

#### 통신 연결
- [ ] 아두이노 메가 ↔ PC USB 케이블 연결
- [ ] 장치 관리자에서 COM 포트 인식 확인
- [ ] Arduino IDE에서 펌웨어 업로드

#### 밸브 액추에이터 (7개)
- [ ] Valve 0 (Ethanol Main): 서보 + 리미트 스위치 2개
- [ ] Valve 1 (N2O Main): 서보 + 리미트 스위치 2개
- [ ] Valve 2 (Ethanol Purge): 서보 + 리미트 스위치 2개
- [ ] Valve 3 (N2O Purge): 서보 + 리미트 스위치 2개
- [ ] Valve 4 (Pressurant Fill): 서보 + 리미트 스위치 2개
- [ ] Valve 5 (System Vent): 서보 + 리미트 스위치 2개
- [ ] Valve 6 (Igniter Fuel): 서보 + 리미트 스위치 2개

#### 센서 연결
- [ ] 압력 센서 4개 (PT1~PT4): 아날로그 핀 A0~A3
- [ ] 온도 센서 2개 (TC1, TC2): MAX6675 모듈, SPI 통신
- [ ] 유량 센서 2개 (Flow1, Flow2): 디지털 핀 2, 3 (인터럽트)

## 🖥️ 사용자 인터페이스

### 메인 대시보드

#### 1. Header (상단 제어 패널)
- **포트 선택**: COM 포트 드롭다운 및 새로고침 버튼
- **연결 상태**: 실시간 연결 상태 표시 (Disconnected/Connecting/Connected)
- **Connect/Disconnect**: 시리얼 연결 제어 버튼
- **로깅 제어**: Start/Stop Logging 버튼
- **응급 셧다운**: Emergency Shutdown 버튼

#### 2. Sensor Panel (센서 데이터)
- **압력 센서**: PT1~PT4 실시간 압력 값 (PSI)
- **온도 센서**: TC1, TC2 실시간 온도 값 (K)
- **유량 센서**: Flow1, Flow2 실시간 유량 값 (L/h)
- **상태 표시**: 정상/경고/오류 상태별 색상 구분

#### 3. Valve Control Panel (밸브 제어)
- **밸브 상태**: 각 밸브별 OPEN/CLOSED 상태 표시
- **리미트 스위치**: LS_OPEN, LS_CLOSED 상태 실시간 표시
- **제어 버튼**: 각 밸브별 OPEN/CLOSE 버튼
- **안전 표시**: 압력 한계 초과 시 제어 비활성화

#### 4. Sequence Panel (시퀀스 제어)
- **시퀀스 목록**: 사용 가능한 모든 시퀀스 표시
- **실행 상태**: 진행 중인 시퀀스 및 진행률
- **Cancel 버튼**: 실행 중인 시퀀스 취소
- **Emergency Shutdown**: 응급 셧다운 시퀀스

#### 5. Data Chart Panel (실시간 차트)
- **다중 센서 차트**: 모든 센서 데이터 동시 표시
- **실시간 업데이트**: 0.1초 간격 데이터 갱신
- **축소/확대**: 시간 범위 조절 가능
- **데이터 포인트**: 최대 100개 데이터 포인트 유지

#### 6. Terminal Panel (로그 터미널)
- **실시간 로그**: 모든 시스템 로그 표시
- **자동 스크롤**: 최신 로그로 자동 이동
- **로그 필터링**: 로그 레벨별 필터링 가능
- **최대 로그**: 500개 로그 유지

### 시스템 연결 과정

#### 1. 포트 선택 및 연결
```bash
1. Header에서 포트 새로고침 버튼 클릭
2. COM 포트 드롭다운에서 Arduino 포트 선택
3. Connect 버튼 클릭
4. 연결 상태 변화 확인: Disconnected → Connecting → Connected
5. 센서 데이터 수신 시작 확인
```

#### 2. 연결 성공 시 확인사항
- [ ] 상태 표시: 🟢 Connected
- [ ] Toast 알림: "Connected to [포트]" 표시
- [ ] 센서 데이터 실시간 수신 (0.1초 간격)
- [ ] 밸브 상태 실시간 업데이트
- [ ] Terminal에 연결 성공 로그 표시

#### 3. 연결 실패 시 대처
- USB 케이블 재연결
- 다른 COM 포트 시도
- Arduino 리셋 후 재시도
- 장치 관리자에서 포트 상태 확인
- Arduino IDE로 펌웨어 상태 확인

## 🔧 시스템 기능

### 1. 실시간 데이터 모니터링

#### 센서 데이터 수집
```typescript
interface SensorData {
  pt1: number;    // 압력 센서 1 (PSI)
  pt2: number;    // 압력 센서 2 (PSI)
  pt3: number;    // 압력 센서 3 (PSI)
  pt4: number;    // 압력 센서 4 (PSI)
  tc1: number;    // 온도 센서 1 (K)
  tc2: number;    // 온도 센서 2 (K)
  flow1: number;  // 유량 센서 1 (L/h)
  flow2: number;  // 유량 센서 2 (L/h)
}
```

#### 밸브 상태 추적
```typescript
interface ValveState {
  state: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  lsOpen: boolean;    // 리미트 스위치 OPEN
  lsClosed: boolean;  // 리미트 스위치 CLOSED
  id: number;         // 밸브 ID (0-6)
  name: string;       // 밸브 이름
}
```

### 2. 시퀀스 자동화 시스템

#### 시퀀스 구조
```typescript
interface SequenceStep {
  message: string;     // 단계 설명
  delay: number;       // 지연 시간 (ms)
  commands: string[];  // 실행할 명령 배열
  sensors?: {          // 센서 조건 (선택적)
    condition: string;
    timeoutMs: number;
  };
}
```

#### 내장 시퀀스
1. **Random Test A** - 기본 밸브 동작 테스트 (9단계)
2. **Random Test B** - 혼합 동작 테스트 (9단계)
3. **Random Test C** - 복합 동작 테스트 (10단계)
4. **Multi-Open Test** - 동시 제어 테스트 (7단계)
5. **Sequential Mix** - 순차 동작 테스트 (9단계)
6. **Chaos Test** - 복잡한 시나리오 (8단계)
7. **Emergency Shutdown** - 응급 안전 절차 (5단계)

### 3. 안전 시스템

#### 자동 응급 셧다운 트리거
- **압력 한계 초과**: 850 PSI 초과 시 3회 연속 감지
- **통신 오류**: Arduino 연결 중단 감지
- **센서 조건 실패**: 시퀀스 중 타임아웃 발생
- **수동 트리거**: Emergency Shutdown 버튼

#### 페일세이프 동작
```typescript
// 응급 셧다운 시퀀스
1. 모든 주 밸브 즉시 닫기 (100ms)
2. 시스템 벤트 열기 (200ms)
3. 가압 밸브 닫기 (100ms)
4. 퍼지 밸브 열기 (200ms)
5. 시스템 안전 상태 확인 (500ms)
```

### 4. 데이터 로깅

#### 자동 로깅 기능
- **CSV 형식**: 타임스탬프, 센서 값, 밸브 상태
- **세션 기반**: 각 세션마다 별도 폴더 생성
- **설정 스냅샷**: config.json, sequences.json 백업
- **실시간 플러시**: 2초마다 자동 저장

#### 로그 파일 구조
```
Documents/rocket-logs/
└── session-YYYYMMDD-HHMMSS/
    ├── data.csv           # 센서 데이터
    ├── config.json        # 설정 스냅샷
    └── sequences.json     # 시퀀스 스냅샷
```

## ⚙️ 설정 및 구성

### config.json
```json
{
  "serial": {
    "baudRate": 115200           // 시리얼 통신 속도
  },
  "pressureLimit": 850,          // 압력 한계값 (PSI)
  "valveFeedbackTimeout": 0,     // 밸브 피드백 타임아웃 (0=비활성화)
  "maxChartDataPoints": 100,     // 차트 최대 데이터 포인트
  "logging": {
    "enabled": true,             // 로깅 활성화
    "flushInterval": 2000        // 플러시 간격 (ms)
  }
}
```

### sequences.json
시퀀스 정의 파일로 JSON 스키마(`sequences.schema.json`)로 검증됩니다.

```json
{
  "Random Test A": [
    {
      "message": "Open System Vent",
      "delay": 800,
      "commands": ["CMD,System Vent,Open"]
    },
    {
      "message": "Open Ethanol Main",
      "delay": 1200,
      "commands": ["CMD,Ethanol Main,Open"]
    }
    // ... 더 많은 단계
  ]
}
```

### Arduino 설정

#### 유량 센서 계수
```cpp
#define K_PULSE_PER_L_FLOW1 1484.11f  // Flow1 (에탄올)
#define K_PULSE_PER_L_FLOW2 1593.79f  // Flow2 (N2O)
```

#### 서보 스톨 방지
```cpp
#define STALL_RELIEF_ANGLE 3      // 릴리프 각도 (도)
#define STALL_RELIEF_TIME 200     // 릴리프 시간 (ms)
#define SERVO_SETTLE_TIME 500     // 서보 안정화 시간 (ms)
```

## 🔒 보안 및 안전

### Electron 보안 설정
- **Context Isolation**: 활성화
- **Node Integration**: 비활성화
- **Sandbox**: 활성화
- **Content Security Policy**: 설정됨
- **Preload Script**: 보안 API 노출

### 안전 점검사항
- [ ] 모든 인원 안전 거리 확보
- [ ] 응급 셧다운 절차 숙지
- [ ] 수동 밸브 제어 방법 확인
- [ ] 압력 한계 설정 적절성 검토
- [ ] 비상 연락망 준비

### 금지사항
- ❌ 압력 한계 초과 상태에서 시험 진행
- ❌ 센서 오류 상태에서 시퀀스 실행
- ❌ 응급 셧다운 무시하고 작업 진행
- ❌ 밸브 피드백 없이 고압 작업

## 🧪 테스트 및 운영

### 시스템 검증 절차

#### 1. 연결 테스트
```bash
# 1. Arduino 펌웨어 업로드 확인
# 2. USB 연결 및 COM 포트 인식
# 3. GUI에서 포트 선택 및 연결
# 4. 센서 데이터 수신 확인
# 5. 밸브 상태 동기화 확인
```

#### 2. 개별 밸브 테스트
각 밸브별 동작 확인:

**Valve 0 (Ethanol Main)**
- 초기 각도: OPEN=7°, CLOSE=98°
- 동작 시퀀스: IDLE → MOVING → INCHING → STALL_RELIEF → IDLE
- 리미트 스위치: LS_OPEN, LS_CLOSED 상태 확인

**Valve 1 (N2O Main)**
- 초기 각도: OPEN=25°, CLOSE=121°

**Valve 2 (Ethanol Purge)**
- 초기 각도: OPEN=12°, CLOSE=105°

**Valve 3 (N2O Purge)**
- 초기 각도: OPEN=13°, CLOSE=117°

**Valve 4 (Pressurant Fill)**
- 초기 각도: OPEN=27°, CLOSE=129°

**Valve 5 (System Vent)**
- 초기 각도: OPEN=39°, CLOSE=135°

**Valve 6 (Igniter Fuel)**
- 초기 각도: OPEN=45°, CLOSE=135°

#### 3. 센서 검증
- **압력 센서**: 0~850 PSI 범위, ±1% 정확도
- **온도 센서**: MAX6675 기반, 0~1024°C 범위
- **유량 센서**: 펄스 기반, 교정 계수 적용

### 운영 시나리오

#### 냉간 유동 테스트
```bash
1. Random Test A - 기본 밸브 동작 (9.9초)
2. Multi-Open Test - 동시 제어 (7.6초)
3. Sequential Mix - 실제 시험 모사 (9.4초)
```

#### 온간 유동 테스트
```bash
1. Chaos Test - 극한 상황 시뮬레이션 (7.2초)
2. 사용자 정의 시퀀스 실행
3. 실시간 센서 모니터링 강화
```

### 응급상황 대응

#### 자동 트리거 조건
1. **압력 초과**: 850 PSI 초과 3회 연속 (0.3초)
2. **통신 오류**: Arduino 연결 중단
3. **센서 타임아웃**: 시퀀스 중 조건 대기 실패
4. **수동 트리거**: Emergency Shutdown 버튼

#### 응급 셧다운 시퀀스
```bash
[T+0ms]   🚨 EMERGENCY SHUTDOWN INITIATED
[T+100ms] 모든 주 밸브 닫기 (Ethanol Main, N2O Main)
[T+300ms] 시스템 벤트 열기 (System Vent)
[T+400ms] 가압 밸브 닫기 (Pressurant Fill)
[T+600ms] 퍼지 밸브 열기 (Ethanol Purge, N2O Purge)
[T+1100ms] 🛡️ Emergency shutdown completed
```

## 🚀 시퀀스 실행 가이드

### 사용 가능한 시퀀스

#### 기본 테스트 시퀀스
- **Random Test A** (9단계, 9.9초) - 기본 밸브 동작 테스트
- **Random Test B** (9단계) - 혼합 동작 테스트
- **Random Test C** (10단계) - 복합 동작 테스트

#### 고급 테스트 시퀀스
- **Multi-Open Test** (7단계, 7.6초) - 동시 제어 테스트
- **Sequential Mix** (9단계, 9.4초) - 실제 시험 절차 모사
- **Chaos Test** (8단계, 7.2초) - 극한 상황 시뮬레이션

#### 안전 시퀀스
- **Emergency Shutdown** (5단계, 1.1초) - 응급 안전 절차

### 시퀀스 실행 절차

```bash
1. Sequence Panel에서 원하는 시퀀스 선택
2. "Start Sequence" 버튼 클릭
3. 실시간 진행 상황 모니터링
4. Terminal Panel에서 로그 확인
5. 필요시 "Cancel" 버튼으로 중단
```

### 실시간 모니터링

#### Terminal 로그 예시
```
[14:23:45] Initiating sequence: Random Test A
[14:23:45] Step 1/9: Open System Vent
[14:23:46] Command sent: {"type":"RAW","payload":"V,5,O"}
[14:23:46] Valve 5 status: CLOSED → OPEN
[14:23:47] Step 2/9: Open Ethanol Main
...
[14:23:55] Sequence Random Test A completed successfully
```

#### 진행률 표시
- 현재 단계 / 전체 단계
- 남은 시간 예상치
- 실행 중인 명령 실시간 표시
- 오류 발생 시 즉시 알림

#### 냉간유동 테스트 (차가운 상태에서 유체 흐름 테스트)

**1. Random Test A - 기본 밸브 동작 테스트**:
```
단계별 시나리오:
[800ms] "Open System Vent" 
  └─ CMD: System Vent → OPEN
[1200ms] "Open Ethanol Main"
  └─ CMD: Ethanol Main → OPEN  
[1500ms] "Open Pressurant Fill"
  └─ CMD: Pressurant Fill → OPEN
[900ms] "Close System Vent"
  └─ CMD: System Vent → CLOSE
[1300ms] "Open N2O Main"
  └─ CMD: N2O Main → OPEN
[1100ms] "Close Ethanol Main" 
  └─ CMD: Ethanol Main → CLOSE
[1400ms] "Close N2O Main"
  └─ CMD: N2O Main → CLOSE
[600ms] "Open Ethanol Purge"
  └─ CMD: Ethanol Purge → OPEN
[1000ms] "Close Pressurant Fill"
  └─ CMD: Pressurant Fill → CLOSE
```
- [ ] 총 소요시간: 약 9.9초
- [ ] 주요 확인사항: 기본 밸브들의 순차 개폐 동작

**2. Multi-Open Test - 동시 제어 테스트**:
```
동시 명령 처리 확인:
[1000ms] "Open System Vent & Ethanol Main"
  ├─ CMD: System Vent → OPEN
  └─ CMD: Ethanol Main → OPEN (동시 실행)
[1500ms] "Open N2O Main & Pressurant Fill" 
  ├─ CMD: N2O Main → OPEN
  └─ CMD: Pressurant Fill → OPEN (동시 실행)
[800ms] "Close System Vent"
  └─ CMD: System Vent → CLOSE
[1200ms] "Open Ethanol Purge & N2O Purge"
  ├─ CMD: Ethanol Purge → OPEN  
  └─ CMD: N2O Purge → OPEN (동시 실행)
[1100ms] "Close Ethanol Main & N2O Main"
  ├─ CMD: Ethanol Main → CLOSE
  └─ CMD: N2O Main → CLOSE (동시 실행)
[1300ms] "Close All Purges" 
  ├─ CMD: Ethanol Purge → CLOSE
  └─ CMD: N2O Purge → CLOSE (동시 실행)
[700ms] "Close Remaining Valves"
  └─ CMD: Pressurant Fill → CLOSE
```
- [ ] 총 소요시간: 약 7.6초
- [ ] 주요 확인사항: 다중 밸브 동시 제어 능력

**3. Sequential Mix - 실제 운용 시뮬레이션**:
```
실제 시험 절차 모사:
[1000ms] "Start with Purges" (퍼지 시작)
  └─ CMD: Ethanol Purge → OPEN
[800ms] "Add N2O Purge" (N2O 퍼지 추가)
  └─ CMD: N2O Purge → OPEN
[1200ms] "Switch to Mains" (메인 라인 전환)
  ├─ CMD: Ethanol Main → OPEN
  └─ CMD: Ethanol Purge → CLOSE
[900ms] "Add N2O Main" (N2O 메인 추가)
  └─ CMD: N2O Main → OPEN
[1100ms] "System Control" (시스템 제어)
  ├─ CMD: System Vent → OPEN
  └─ CMD: N2O Purge → CLOSE
[1300ms] "Pressurization" (가압)
  └─ CMD: Pressurant Fill → OPEN
[700ms] "System Vent Close" (벤트 닫기)
  └─ CMD: System Vent → CLOSE 
[1400ms] "Shutdown" (셧다운)
  ├─ CMD: Ethanol Main → CLOSE
  └─ CMD: N2O Main → CLOSE
[1000ms] "Final Close" (최종 닫기)
  └─ CMD: Pressurant Fill → CLOSE
```
- [ ] 총 소요시간: 약 9.4초
- [ ] 주요 확인사항: 실제 로켓 테스트와 유사한 절차

#### 온간유동 테스트 (가열된 상태에서 유체 흐름 테스트)

**Chaos Test - 복잡한 시나리오 테스트**:
```
극한 상황 시뮬레이션:
[500ms] "Open Everything" (전체 개방)
  ├─ CMD: System Vent → OPEN
  ├─ CMD: Ethanol Main → OPEN  
  └─ CMD: N2O Main → OPEN
[800ms] "Add More Opens" (추가 개방)
  ├─ CMD: Pressurant Fill → OPEN
  └─ CMD: Ethanol Purge → OPEN
[600ms] "Random Close" (무작위 닫기)
  └─ CMD: Ethanol Main → CLOSE
[1000ms] "More Opens" (더 많은 개방)
  └─ CMD: N2O Purge → OPEN
[700ms] "Random Close 2" (무작위 닫기 2)
  └─ CMD: System Vent → CLOSE
[900ms] "Random Close 3" (무작위 닫기 3)
  ├─ CMD: N2O Main → CLOSE
  └─ CMD: Ethanol Purge → CLOSE
[1200ms] "Final Random" (최종 무작위)
  └─ CMD: Pressurant Fill → CLOSE
[1500ms] "Close All Remaining" (나머지 모두 닫기)
  └─ CMD: N2O Purge → CLOSE
```
- [ ] 총 소요시간: 약 7.2초
- [ ] 주요 확인사항: 시스템 안정성 및 예외 상황 처리

#### 시퀀스 실행 중 모니터링
**Terminal Panel 로그 확인**:
```
[14:23:45] Initiating sequence: Random Test A
[14:23:45] Open System Vent
[14:23:46] Command sent successfully: {"type":"RAW","payload":"V,5,O"}
[14:23:46] Valve feedback disabled - proceeding without confirmation
[14:23:47] Open Ethanol Main
[14:23:47] Command sent successfully: {"type":"RAW","payload":"V,0,O"}
[14:23:49] Open Pressurant Fill
...
[14:23:55] Sequence Random Test A complete.
```

**실시간 센서 모니터링**:
- [ ] 압력 변화 관찰 (밸브 개폐에 따른)
- [ ] 유량 변화 확인 (유체 흐름 시작/중단)
- [ ] 온도 안정성 확인
- [ ] 차트에서 트렌드 분석

**밸브 상태 추적**:
- [ ] 각 단계마다 올바른 밸브가 동작하는지 확인
- [ ] 리미트 스위치 상태 변경 확인
- [ ] 예상치 못한 밸브 상태 변경 없는지 확인

### **5단계: 응급상황 대응**

#### 자동 응급 셧다운 상세 시나리오

**1. 압력 한계 초과 (가장 일반적)**:
```
조건: 압력 센서(PT1~PT4) 중 하나가 850 PSI 초과
트리거: 3회 연속 측정(0.3초)에서 한계 초과
동작 과정:
[감지] 압력 초과 감지 → 경고 카운트 증가
[로그] "Pressure warning 1/3: 867.5 > 850"
[감지] 두 번째 초과 → 카운트 2/3  
[감지] 세 번째 초과 → 응급 셧다운 트리거
[실행] "🚨 EMERGENCY TRIGGERED" 로그
[실행] 자동으로 Emergency Shutdown 시퀀스 실행
```

**2. 통신 오류**:
```
조건: 시리얼 통신 중단 또는 명령 전송 실패
트리거: 아두이노와 통신 불가 상태
동작 과정:
[감지] "Serial communication error: Port disconnected"
[시도] 자동 재연결 시도 (최대 3회)
[실패] 재연결 실패 시 응급 셧다운
[경고] "MANUAL INTERVENTION REQUIRED"
```

**3. 센서 조건 실패**:
```
조건: 시퀀스 중 센서 조건 대기 실패
예시: "센서 온도가 300K에 도달해야 하는데 30초 타임아웃"
동작 과정:
[로그] "TIMEOUT: Sensor tc1 did not reach 300 within 30000ms"
[로그] "Consider increasing timeoutMs in sequence configuration"
[실행] 응급 셧다운 자동 트리거
```

**4. 밸브 피드백 오류**:
```
조건: 밸브가 명령을 받았지만 리미트 스위치 응답 없음
동작 과정:
[로그] "Valve 2 feedback timeout after 5000ms - state uncertain"
[경고] "Consider checking valve 2 manually"
[결정] 비응급 시퀀스: 계속 진행
[결정] 응급 시퀀스: 즉시 셧다운
```

#### Emergency Shutdown 시퀀스 상세 분석

**시퀀스 구성** (sequences.json에서):
```json
"Emergency Shutdown": [
  {
    "message": "Emergency: Close All Main Valves",
    "delay": 100,
    "commands": ["CMD,Ethanol Main,Close", "CMD,N2O Main,Close"]
  },
  {
    "message": "Emergency: Open System Vent", 
    "delay": 200,
    "commands": ["CMD,System Vent,Open"]
  },
  {
    "message": "Emergency: Close Pressurant Fill",
    "delay": 100, 
    "commands": ["CMD,Pressurant Fill,Close"]
  },
  {
    "message": "Emergency: Open All Purges",
    "delay": 200,
    "commands": ["CMD,Ethanol Purge,Open", "CMD,N2O Purge,Open"]
  },
  {
    "message": "System Safe",
    "delay": 500,
    "commands": []
  }
]
```

**실행 과정 상세**:
```
[T+0ms] 🚨 EMERGENCY SHUTDOWN INITIATED
  └─ "Highest priority sequence - aborting all other operations"
  
[T+100ms] "Emergency: Close All Main Valves"
  ├─ CMD: Ethanol Main → CLOSE (즉시)
  ├─ CMD: N2O Main → CLOSE (즉시)
  └─ 목적: 주 추진제 라인 차단
  
[T+300ms] "Emergency: Open System Vent" 
  ├─ CMD: System Vent → OPEN
  └─ 목적: 시스템 압력 배출
  
[T+400ms] "Emergency: Close Pressurant Fill"
  ├─ CMD: Pressurant Fill → CLOSE  
  └─ 목적: 가압제 공급 중단
  
[T+600ms] "Emergency: Open All Purges"
  ├─ CMD: Ethanol Purge → OPEN
  ├─ CMD: N2O Purge → OPEN
  └─ 목적: 라인 내 잔여 추진제 배출
  
[T+1100ms] "System Safe"
  ├─ 대기 시간 (추가 명령 없음)
  └─ 🛡️ "Emergency shutdown completed - system returned to safe state"
```

#### 수동 응급 셧다운 절차

**GUI를 통한 수동 실행**:
1. **즉시 실행**: Sequence Panel에서 "Emergency Shutdown" 클릭
2. **확인**: "Emergency In Progress" 메시지 (중복 실행 방지)
3. **모니터링**: Terminal Panel에서 실시간 진행 상황 확인
4. **완료 확인**: "Emergency state cleared" 메시지까지 대기

**물리적 응급 상황 시 대처**:
```
[상황 1] GUI 응답 없음
├─ 아두이노 리셋 버튼 누르기
├─ 주 전원 차단
└─ 수동 밸브 조작

[상황 2] 통신 완전 중단
├─ "MANUAL INTERVENTION REQUIRED" 메시지 확인
├─ 물리적으로 주 밸브들 수동 닫기
├─ 시스템 벤트 수동 열기
└─ 전원 차단 후 안전 점검

[상황 3] 센서 오류로 인한 오판
├─ 실제 압력/온도 육안 확인
├─ 필요시 응급 셧다운 무시하고 수동 제어
└─ 센서 재보정 후 재시작
```

#### 응급상황 후 복구 절차

**시스템 상태 확인**:
- [ ] 모든 밸브가 안전 위치에 있는지 확인
- [ ] 압력이 정상 범위로 돌아왔는지 확인
- [ ] 온도가 안전 범위인지 확인
- [ ] 통신이 정상 복구되었는지 확인

**재시작 절차**:
1. **원인 분석**: 응급 셧다운 원인 파악 및 해결
2. **하드웨어 점검**: 밸브, 센서, 배선 상태 확인
3. **시스템 리셋**: GUI 재시작 및 재연결
4. **안전 테스트**: 개별 밸브 동작 테스트
5. **시퀀스 재개**: 단순한 테스트부터 재시작

**로그 분석 및 보고**:
- [ ] Terminal 로그 전체 저장
- [ ] 센서 데이터 차트 분석
- [ ] 응급 상황 발생 시점 특정
- [ ] 시스템 응답 시간 평가
- [ ] 개선사항 도출

## ⚠️ 주요 오류 상황 및 상세 대처법

### **연결 관련 오류**
| 오류 | 원인 | 대처법 |
|------|------|---------|
| 시리얼 포트 연결 실패 | USB 케이블 또는 드라이버 문제 | 케이블 재연결, 다른 COM 포트 시도 |
| 연결 중 데이터 수신 중단 | 통신 불안정 | 연결 해제 후 재연결 |
| 명령 전송 실패 | 하드웨어 통신 오류 | 응급 셧다운 후 수동 점검 |

### **센서 관련 오류**
| 오류 | 원인 | 대처법 |
|------|------|---------|
| 압력 한계 초과 경고 | 시스템 압력 급상승 | 자동 응급 셧다운 실행됨, 원인 파악 후 재시작 |
| 센서 데이터 없음 | 센서 연결 문제 | 센서 케이블 및 전원 확인 |
| 센서 조건 타임아웃 | 목표 값 도달 실패 | 시퀀스 중단, 수동으로 조건 확인 |

### **밸브 제어 오류**
| 오류 | 원인 | 대처법 |
|------|------|---------|
| 밸브 피드백 타임아웃 | 밸브 동작 불량 또는 센서 오류 | 수동으로 밸브 상태 확인, 필요시 응급 셧다운 |
| 밸브 상태 불일치 | 하드웨어와 소프트웨어 상태 차이 | 연결 재설정 또는 수동 확인 |

### **시퀀스 실행 오류**
| 오류 | 원인 | 대처법 |
|------|------|---------|
| 시퀀스 파일 로드 실패 | sequences.json 파일 오류 | 파일 형식 확인, 백업 파일로 복원 |
| 시퀀스 중단 | 단계별 실행 중 오류 발생 | 로그 확인 후 문제 해결, 필요시 응급 셧다운 |

## 🔧 설정 파일

### config.json
```json
{
  "pressureLimit": 850,           // 압력 한계값 (PSI)
  "valveFeedbackTimeout": 0,      // 밸브 피드백 대기시간 (0=비활성화)
  "maxChartDataPoints": 100       // 차트 최대 데이터 포인트
}
```

### 유량센서 계수 (arduino_mega_code.ino)
```cpp
#define K_PULSE_PER_L_FLOW1 1484.11f  // Flow1 계수
#define K_PULSE_PER_L_FLOW2 1593.79f  // Flow2 계수
```
- **Flow1 (에탄올)**: 1484.11 pulse/L
- **Flow2 (N2O)**: 1593.79 pulse/L
- 계수 변경 시 아두이노 코드 업로드 필요

### 서보모터 스톨 방지 기능
```cpp
#define STALL_RELIEF_ANGLE 3     // 리미트 스위치 후 반대방향 회전각도 (도)
#define STALL_RELIEF_TIME 200    // 릴리프 동작 후 대기시간 (ms)
```
- 리미트 스위치가 눌리면 반대방향으로 3도 회전
- 200ms 후 서보모터 전원 차단으로 발열 방지
- 서보 수명 연장 및 스톨 토크 방지

## 📊 실시간 모니터링

### 센서 패널
- **압력**: 실시간 압력 값 및 한계 대비 상태 (4개 센서: pt1, pt2, pt3, pt4)
- **온도**: 시스템 온도 모니터링 (2개 센서: tc1, tc2)
- **유량**: 유량 센서 데이터 (L/h 단위)
  - **Flow1**: 계수 1484.11 pulse/L (에탄올 라인)
  - **Flow2**: 계수 1593.79 pulse/L (N2O 라인)

### 차트 패널
- 실시간 센서 데이터 그래프
- 최근 100개 데이터 포인트 표시
- 시간별 추이 분석 가능

### 터미널 패널
- 모든 시스템 로그 실시간 표시
- 시퀀스 실행 상태 및 오류 메시지
- 최근 500개 로그 유지

## 🚨 안전 수칙

### 필수 안전 점검사항
- [ ] 모든 인원이 안전 거리 확보
- [ ] 응급 셧다운 절차 숙지
- [ ] 수동 밸브 제어 방법 확인
- [ ] 압력 한계 설정 적절성 검토
- [ ] 비상 연락망 준비

### 금지사항
- ❌ 압력 한계 초과 상태에서 시험 진행
- ❌ 센서 오류 상태에서 시퀀스 실행
- ❌ 응급 셧다운 무시하고 작업 진행
- ❌ 밸브 피드백 없이 고압 작업

## 📞 비상 연락처
- **시설 관리**: [연락처 입력]
- **기술 지원**: [연락처 입력]
- **안전 관리**: [연락처 입력]
