<img width="2879" height="1700" alt="image" src="https://github.com/user-attachments/assets/ff2199ca-45b7-43f5-a146-2680b53c5f0f" />

# GOROCKET Control Suite

고로켓 팀의 액체 로켓 엔진을 **유선 시리얼 포트**로 제어하기 위한 데스크톱 GUI입니다. 배포용 애플리케이션이 아닌 개발자의 개인 데스크톱에서만 실행하는 도구로, 네트워크 기능과 보안 모듈은 포함하지 않습니다. 센서 모니터링, 밸브 제어, 자동 시퀀스를 단일 창에서 제공합니다.

## 주요 기능

- **실시간 센서 수집**: 압력 트랜스듀서 4개, 유량 센서 2개, 열전대 1개의 값을 대시보드에 표시.
- **밸브 제어**: 7개의 서보 밸브를 수동으로 열고 닫으며 리미트 스위치 상태를 표시.
- **시퀀스 실행**: 점화, 퍼지, 비상 정지 등 사전 정의된 시퀀스를 버튼 한 번으로 실행.
- **압력 한계 감시**: `config.json`의 `pressureLimit`을 넘으면 자동으로 Emergency Shutdown 시퀀스를 호출.
- **데이터 시각화**: 최근 100초 간의 압력·유량·온도 데이터를 `Recharts`로 그래프화.
- **로그 터미널**: 송·수신된 명령과 시퀀스 진행 상황을 스크롤 가능한 로그 패널에 기록.
- **줌 컨트롤**: `Ctrl`+휠 또는 단축키(`Ctrl`+`=`, `Ctrl`+`-`, `Ctrl`+`0`)로 화면 확대·축소.
- **CSV 데이터 로깅**: 버튼으로 데이터 수집을 시작·종료하면 `Documents/rocket-log-날짜.csv` 형식의 파일로 센서 값 저장.
- **설정 파일 기반 매핑**: `config.json`에서 밸브 이름과 서보 인덱스를 정의하고 런타임에 로드.

## 기술 스택

- **Electron 37**: 데스크톱 앱 셸과 시리얼 포트 접근 담당.
- **Next.js 15 (App Router)**: React 기반 렌더러 UI.
- **TypeScript**: 메인·렌더러·프리로드 전역에 사용.
- **Tailwind CSS + Shadcn UI**: 다크 테마 및 UI 컴포넌트.
- **SerialPort**: 하드웨어와의 시리얼 통신.
- **Recharts**: 센서 데이터 시각화.

## 디렉터리 구조

```
.
├── main.ts             # Electron 메인 프로세스 엔트리
├── preload.ts          # 렌더러에서 사용할 IPC 브리지
├── main/               # 메인 프로세스 모듈 (ConfigManager 등)
├── arduino_mega_code/  # 구동 장치용 아두이노 펌웨어
├── config.json         # 시리얼 및 밸브 매핑 설정
├── src/
│   ├── app/            # Next.js 엔트리 (layout.tsx, page.tsx, 전역 CSS)
│   ├── components/
│   │   ├── dashboard/  # 센서, 밸브, 시퀀스, 로그 등 도메인 패널
│   │   └── ui/         # 버튼·카드 등 공용 UI 컴포넌트
│   ├── hooks/          # useSerialManager, useSequenceManager 등 커스텀 훅
│   ├── lib/            # 공용 유틸 함수 (예: 클래스명 병합)
│   ├── types/          # 전역 타입 및 IPC 인터페이스
│   └── utils/          # 센서 파서 등 기타 유틸
├── docs/blueprint.md   # 초기 설계 문서
└── package.json        # 스크립트 및 의존성 정의
```

## 구성 요소 및 작동 메커니즘

### 1. Electron 메인 프로세스 (`main.ts`)
- 앱 시작 시 `config.json`을 읽어 시리얼 통신 파라미터와 밸브-서보 인덱스 매핑을 메모리에 적재.
- `BrowserWindow`를 생성해 Next.js로 빌드된 페이지를 로드하고 개발 모드에서는 DevTools 자동 실행.
- `serialport` 라이브러리로 포트 목록 조회, 연결·해제, 오류 처리 담당.
- 수신된 시리얼 문자열을 렌더러에 중계하고, 렌더러에서 전달된 명령을 검증 후 하드웨어로 전송.
- `start-logging`/`stop-logging` IPC 이벤트로 CSV 파일을 열고 닫으며 센서 값 기록.
- 줌 인·아웃·리셋 이벤트를 처리해 렌더러 확대 배율 제어.

### 2. Preload 스크립트 (`preload.ts`)
- `contextBridge`로 `window.electronAPI` 네임스페이스를 노출하여 렌더러가 Node 환경과 분리된 상태에서 IPC 사용.
- 제공 메서드: `getSerialPorts`, `connectSerial`, `disconnectSerial`, `sendToSerial`, `onSerialData`, `onSerialError`, `startLogging`, `stopLogging`, `getConfig`, `zoomIn/Out/Reset`, `onLogCreationFailed` 등.

### 3. Next.js 렌더러 (`src/app/page.tsx`)
- 시작 시 `getSerialPorts()`와 `getConfig()`를 호출해 초기 상태 준비.
- 센서·밸브·시퀀스 상태를 `useSerialManager` 훅에서 통합 관리.
- 밸브 제어 시 `config.json`의 매핑을 활용해 `sendToSerial`로 명령 전송.
- 로그 토글 시 `startLogging`/`stopLogging` IPC로 파일 스트림 제어.
- `SequencePanel`이 정의된 시퀀스를 실행하며, 압력 한계 초과 시 자동 `Emergency Shutdown`.
- `DataChartPanel`은 최근 샘플을 `Recharts`로 렌더링하고 임계선 표시.
- `TerminalPanel`은 송·수신 로그와 시퀀스 진행을 실시간으로 표시.

### 4. 커스텀 훅과 유틸
- `useSerialManager`: 포트 목록, 연결 상태, 센서·밸브 데이터를 통합 관리.
- `useSequenceManager`: 점화·퍼지·비상정지 등 자동 시퀀스를 정의·실행.
- `useSensorData`/`useValveControl`: 수신 문자열 파싱과 밸브 상태 업데이트 모듈화.
- `use-toast`: Shadcn UI 기반 토스트 알림.
- `lib/utils.ts`: Tailwind 클래스 병합 함수 `cn`.

## 개발 및 실행

```bash
npm install          # 의존성 설치
npm run dev          # Next.js(9002)와 Electron을 동시에 실행
npm run build        # 프로덕션 빌드 (Next.js + electron-builder)

# 품질 검사
npm run lint         # ESLint
npm run typecheck    # TypeScript 타입 검사
```

## 시리얼 통신 프로토콜

- 명령 전송 형식: `V,서보인덱스,상태` 예) `V,0,O` (0번 서보 밸브 열기)
- 수신 데이터는 `key:value` 쌍을 콤마로 구분한 문자열로 가정.
- 밸브와 서보의 매핑은 프로젝트 루트의 `config.json` 파일에서 정의.

## 설정 파일 구조 (`config.json`)

```json
{
  "serial": { "baudRate": 115200 },
  "maxChartDataPoints": 100,
  "pressureLimit": 850,
  "initialValves": [
    { "id": 1, "name": "Ethanol Main", "state": "CLOSED" },
    { "id": 2, "name": "N2O Main", "state": "CLOSED" }
  ],
  "valveMappings": {
    "Ethanol Main": { "servoIndex": 0 },
    "N2O Main": { "servoIndex": 1 }
  }
}
```

- `serial.baudRate`: 시리얼 포트를 열 때 사용할 보드레이트.
- `maxChartDataPoints`: 그래프에 유지할 샘플 개수.
- `pressureLimit`: 초과 시 비상 정지를 트리거할 압력(kPa).
- `initialValves`: 앱 시작 시 렌더링할 밸브 목록 및 초기 상태.
- `valveMappings`: UI에 표시되는 밸브 이름을 서보 인덱스로 매핑.

## 데이터 로깅 메커니즘

- `Header`의 로그 버튼을 누르면 `startLogging` IPC 메시지가 전송되어 메인 프로세스가 `Documents/rocket-log-YYYYMMDD-HHMMSS.csv` 파일을 생성.
- 로깅 중에는 수신한 센서 값이 CSV 포맷으로 파일에 append되며, `stopLogging` 메시지로 파일 스트림을 닫음.
- 로그 생성 실패 시 `log-creation-failed` 이벤트가 렌더러로 전달되어 사용자에게 알림을 표시.

## 스타일 가이드

- 기본 배경: `#222225`, 기본 전경: `#F9FAFB`, 강조색: 전기 파랑(`#7DF9FF`).
- 본문 폰트: `Inter`, 코드/로그 폰트: `Source Code Pro`.
- Tailwind CSS 변수로 색상을 선언하고 다크 모드에 최적화.

## 참고 문서

- `docs/blueprint.md`에 초기 요구사항과 디자인 가이드가 정리되어 있습니다.

---

이 README는 개발자가 데스크톱에서 안전하게 로켓 엔진을 제어할 수 있도록 현재 코드 구조와 사용 방법을 문서화한 것입니다. 배포판이 아니므로 보안·결함에 대한 책임은 사용자에게 있습니다.
