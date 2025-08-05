# GOROCKET Control Suite

고로켓 팀의 액체 로켓 엔진을 제어하고 감시하기 위한 **Electron + Next.js** 기반 데스크톱 GUI입니다. 시리얼 포트를 통해 구동 장치와 통신하며, 센서 데이터 표시부터 밸브 제어·자동 시퀀스까지 발사 준비에 필요한 기능을 제공합니다.

## 주요 기능

- **실시간 센서 수집**: 압력 트랜스듀서 4개, 유량 센서 2개, 열전대 1개의 값을 수신해 대시보드에 표시합니다.
- **밸브 제어**: 7개의 서보 밸브를 수동으로 열고 닫을 수 있으며 각 밸브의 리미트 스위치 상태를 표시합니다.
- **시퀀스 실행**: 점화, 퍼지, 비상 정지 등 미리 정의된 제어 시퀀스를 버튼 한 번으로 실행합니다.
- **데이터 시각화**: 최근 100초 간의 압력·유량·온도 데이터를 `Recharts`로 그래프화하고, 한계 압력선을 표시합니다.
- **로그 터미널**: 송·수신된 명령과 시퀀스 진행 상황을 스크롤 가능한 로그 패널에 기록합니다.
- **줌 컨트롤**: `Ctrl`+휠 또는 단축키(`Ctrl`+`=`, `Ctrl`+`-`, `Ctrl`+`0`)로 화면 확대·축소가 가능합니다.

## 기술 스택

- **Electron 37**: 데스크톱 앱 셸과 시리얼 포트 접근을 담당합니다.
- **Next.js 15 (App Router)**: React 기반 렌더러 UI 프레임워크.
- **TypeScript**: 정적 타입 정의 및 빌드 안정성 확보.
- **Tailwind CSS + Shadcn UI**: 일관된 다크 테마와 재사용 가능한 UI 컴포넌트.
- **SerialPort**: 하드웨어와의 시리얼 통신.
- **Recharts**: 센서 데이터 시각화.

## 디렉터리 구조

```
.
├── main.js              # Electron 메인 프로세스, 시리얼 포트 및 줌 제어
├── preload.js           # 렌더러에서 사용할 IPC API 브리지
├── src/
│   ├── app/             # Next.js 엔트리 (layout.tsx, page.tsx, 전역 CSS)
│   ├── components/
│   │   ├── dashboard/   # 센서, 밸브, 시퀀스, 로그 등 도메인 패널
│   │   └── ui/          # 버튼·카드 등 공용 UI 컴포넌트 모음
│   ├── hooks/           # use-toast, use-mobile 등 커스텀 훅
│   ├── lib/             # 공용 유틸 함수 (예: 클래스명 병합)
│   ├── types/           # 전역 타입 및 Electron API 정의
│   └── ai/              # Genkit 기반 AI 연동 샘플 코드
├── docs/blueprint.md    # 초기 설계 문서
└── package.json         # 스크립트 및 의존성 정의
```

## 구성 요소 및 동작 흐름

### 1. Electron 메인 프로세스 (`main.js`)
- `BrowserWindow`를 생성해 Next.js로 빌드된 웹 페이지를 로드합니다.
- `serialport` 라이브러리로 사용 가능한 포트 목록을 제공하고, 선택한 포트와의 연결을 관리합니다.
- 수신한 시리얼 데이터를 렌더러로 전달하고, 렌더러에서 전송한 명령을 하드웨어로 다시 보냅니다.
- IPC 채널을 통해 줌 인·아웃·리셋 이벤트를 처리합니다.

### 2. Preload 스크립트 (`preload.js`)
- `contextBridge`로 `window.electronAPI` 객체를 노출하여 렌더러가 안전하게 IPC 함수를 호출할 수 있게 합니다.
- 제공 메서드: `getSerialPorts`, `connectSerial`, `disconnectSerial`, `sendToSerial`, `onSerialData`, `onSerialError`, `zoomIn/Out/Reset` 등.

### 3. Next.js 렌더러 (`src/app/page.tsx`)
- 센서 데이터와 밸브 상태, 시퀀스 로그 등을 `useState`로 관리합니다.
- `electronAPI`를 통해 시리얼 포트 목록 조회, 연결/해제, 명령 전송을 수행합니다.
- 각 패널 컴포넌트를 조합하여 대시보드를 구성합니다.
  - `Header`: 포트 선택과 연결 상태 표시.
  - `SensorPanel`: 센서 값 카드 표시.
  - `ValveControlPanel`: 밸브 상태 아이콘과 스위치.
  - `SequencePanel`: 사전 정의된 제어 시퀀스 버튼.
  - `DataChartPanel`: 실시간 그래프.
  - `TerminalPanel`: 로그 출력.

### 4. 커스텀 훅과 유틸
- `use-toast`: Shadcn UI 기반 토스트 알림을 전역 상태로 관리합니다.
- `use-mobile`: 뷰포트 너비를 감지해 모바일 여부를 판별합니다.
- `lib/utils.ts`: Tailwind 클래스 병합 함수 `cn` 제공.

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

- 명령 전송 형식: `드라이버번호,채널번호,명령` 예) `1,0,O` (1번 드라이버 0번 채널 밸브 열기)
- 수신 데이터는 `key:value` 쌍을 콤마로 구분한 문자열로 가정합니다.
- 밸브와 모터의 매핑은 프로젝트 루트의 `config.json` 파일에서 정의합니다.

## 스타일 가이드

- 기본 배경: `#222225`, 기본 전경: `#F9FAFB`, 강조색: 전기 파랑(`#7DF9FF`).
- 본문 폰트: `Inter`, 코드/로그 폰트: `Source Code Pro`.
- Tailwind CSS 변수로 색상을 선언하고 다크 모드에 최적화했습니다.

## 참고 문서

- `docs/blueprint.md`에 초기 요구사항과 디자인 가이드가 정리되어 있습니다.

---

이 README는 고로켓 팀이 액체 로켓 엔진 시험 및 발사 준비 과정에서 GUI를 이해하고 유지보수하는 데 도움을 주기 위해 작성되었습니다.
