<img width="2879" height="1700" alt="image" src="https://github.com/user-attachments/assets/ff2199ca-45b7-43f5-a146-2680b53c5f0f" />

# GOROCKET Control Suite

고로켓 팀의 액체 로켓 엔진을 **유선 시리얼 포트**로 제어하기 위한 데스크톱 GUI입니다.  
이 프로그램은 실험실이나 개인 개발 PC에서만 사용되는 **개발 도구**이며,  
배포용 애플리케이션이 아니므로 네트워크 기능이나 보안 모듈은 포함되어 있지 않습니다.  
센서 모니터링, 밸브 제어, 자동 시퀀스를 하나의 창에서 처리할 수 있는 것이 핵심 목적입니다.

---

## 목차
1. [주요 기능](#주요-기능)
2. [시스템 요구 사항](#시스템-요구-사항)
3. [설치 및 실행](#설치-및-실행)
4. [디렉터리 구조](#디렉터리-구조)
5. [구성 요소와 작동 원리](#구성-요소와-작동-원리)
6. [설정 파일 구조](#설정-파일-구조-configjson)
7. [시리얼 통신 프로토콜](#시리얼-통신-프로토콜)
8. [데이터 로깅](#데이터-로깅)
9. [UI 사용 방법](#ui-사용-방법)
10. [품질 검사](#품질-검사)
11. [문제 해결](#문제-해결)
12. [참고 문서](#참고-문서)

---

## 주요 기능
초보자도 기능을 쉽게 이해할 수 있도록 핵심 기능을 항목별로 설명합니다.

- **실시간 센서 수집**  
  압력 트랜스듀서 4개, 유량 센서 2개, 열전대 1개의 값을 주기적으로 받아 대시보드에 표시합니다.
- **밸브 제어**  
  7개의 서보 밸브를 수동으로 열고 닫으며, 리미트 스위치의 상태를 함께 확인합니다.
- **시퀀스 실행**  
  점화, 퍼지, 비상 정지 등 사전에 정의된 시퀀스를 버튼 하나로 실행합니다.
- **압력 한계 감시**  
  `config.json`의 `pressureLimit` 값을 초과하면 자동으로 Emergency Shutdown 시퀀스를 수행합니다.
- **데이터 시각화**  
  최근 100초 동안의 압력·유량·온도 데이터를 `Recharts`를 이용해 그래프로 보여 줍니다.
- **로그 터미널**  
  송수신된 명령과 시퀀스 진행 상황을 스크롤 가능한 로그 패널에 기록합니다.
- **화면 확대/축소**  
  `Ctrl` + 마우스 휠 또는 단축키(`Ctrl` + `=`, `Ctrl` + `-`, `Ctrl` + `0`)로 화면 배율을 조정합니다.
- **CSV 데이터 로깅**  
  버튼으로 데이터 수집을 시작/종료하면 `Documents/rocket-log-YYYYMMDD-HHMMSS.csv` 파일로 센서 값을 저장합니다.
- **설정 파일 기반 매핑**  
  `config.json`에서 밸브 이름과 서보 인덱스를 정의하고, 앱 실행 시 읽어 옵니다.

---

## 시스템 요구 사항
이 프로젝트를 실행하기 위해서는 다음 환경이 필요합니다.

| 항목 | 권장 버전 |
| --- | --- |
| 운영 체제 | Windows 10+, macOS 13+, 최신 Linux 배포판 |
| Node.js | 20.x 이상 |
| npm | 10.x 이상 (Node 설치 시 포함) |
| 하드웨어 | 시리얼 통신이 가능한 USB 포트 |

> **주의:** 실제 로켓 하드웨어에 연결하기 전에 반드시 시뮬레이션 또는 안전한 환경에서 테스트하세요.

---

## 설치 및 실행
아래 절차는 처음 프로젝트를 접하는 사용자를 위한 안내입니다.

1. **Node.js 설치**  
   [Node.js 공식 사이트](https://nodejs.org/)에서 권장 LTS 버전을 다운로드하여 설치합니다.

2. **프로젝트 클론**
   ```bash
   git clone <레포지토리 URL>
   cd Gorocket-Control-System-GUI
   ```

3. **의존성 설치**
   ```bash
   npm install
   ```

4. **개발 모드 실행**  
   Next.js(포트 9002)와 Electron이 동시에 실행됩니다.
   ```bash
   npm run dev
   ```

5. **프로덕션 빌드 생성**
   ```bash
   npm run build
   ```
   생성된 실행 파일은 `dist/` 폴더에 위치합니다.

---

## 디렉터리 구조
프로젝트의 주요 폴더와 파일을 간단히 소개합니다.

```
.
├── main.ts             # Electron 메인 프로세스 진입점
├── preload.ts          # 렌더러에서 사용할 IPC 브리지
├── main/               # 메인 프로세스 모듈 (ConfigManager 등)
├── arduino_mega_code/  # 구동 장치용 아두이노 펌웨어
├── config.json         # 시리얼 및 밸브 매핑 설정
├── src/
│   ├── app/            # Next.js 엔트리 (layout.tsx, page.tsx, 전역 CSS)
│   ├── components/
│   │   ├── dashboard/  # 센서, 밸브, 시퀀스, 로그 등 패널 컴포넌트
│   │   └── ui/         # 버튼·카드 등 공용 UI 컴포넌트
│   ├── hooks/          # 커스텀 훅 (useSerialManager 등)
│   ├── lib/            # 공용 유틸 함수
│   ├── types/          # 전역 타입 및 IPC 인터페이스
│   └── utils/          # 센서 파서 등 기타 유틸
├── docs/blueprint.md   # 초기 설계 문서
└── package.json        # 스크립트 및 의존성 정의
```

---

## 구성 요소와 작동 원리

### 1. Electron 메인 프로세스 (`main.ts`)
- 앱 실행 시 `config.json`을 읽어 시리얼 통신 파라미터와 밸브 매핑 정보를 메모리에 로드합니다.
- `BrowserWindow`를 생성하여 Next.js로 빌드된 페이지를 띄우며, 개발 모드에서는 자동으로 DevTools를 엽니다.
- `serialport` 라이브러리를 사용해 포트 목록을 조회하고 연결/해제 및 오류 처리를 담당합니다.
- 수신된 시리얼 문자열을 렌더러에 전달하고, 렌더러가 보낸 명령을 검증 후 하드웨어에 전송합니다.
- `start-logging` / `stop-logging` IPC 이벤트로 CSV 파일을 열고 닫으며 센서 값을 기록합니다.
- 줌 인/줌 아웃/배율 초기화 이벤트를 처리해 렌더러 화면 배율을 제어합니다.

### 2. Preload 스크립트 (`preload.ts`)
- `contextBridge`를 통해 `window.electronAPI` 네임스페이스를 노출하여 렌더러가 Node 환경과 분리된 상태에서 IPC를 사용합니다.
- 제공 메서드: `getSerialPorts`, `connectSerial`, `disconnectSerial`, `sendToSerial`, `onSerialData`, `onSerialError`,  
  `startLogging`, `stopLogging`, `getConfig`, `zoomIn/Out/Reset`, `onLogCreationFailed` 등.

### 3. Next.js 렌더러 (`src/app/page.tsx`)
- 시작 시 `getSerialPorts()`와 `getConfig()`를 호출하여 초기 상태를 준비합니다.
- `useSerialManager` 훅이 센서·밸브·시퀀스 상태를 통합 관리하며, 밸브 제어 시 `sendToSerial`을 통해 명령을 보냅니다.
- 로그 버튼을 누르면 `startLogging`/`stopLogging` IPC로 파일 스트림을 제어합니다.
- `SequencePanel`은 정의된 시퀀스를 실행하며, 압력 한계 초과 시 자동으로 `Emergency Shutdown`을 수행합니다.
- `DataChartPanel`은 최근 샘플을 `Recharts`로 렌더링하며 임계선도 표시합니다.
- `TerminalPanel`은 송수신 로그와 시퀀스 진행 상황을 실시간으로 보여 줍니다.

### 4. 커스텀 훅과 유틸
- `useSerialManager` : 포트 목록, 연결 상태, 센서·밸브 데이터를 통합 관리합니다.
- `useSequenceManager` : 점화·퍼지·비상 정지 등 자동 시퀀스를 정의하고 실행합니다.
- `useSensorData` / `useValveControl` : 수신 문자열을 파싱하고 밸브 상태를 업데이트합니다.
- `use-toast` : Shadcn UI 기반 토스트 알림을 제공합니다.
- `lib/utils.ts` : Tailwind 클래스 병합 함수 `cn` 등을 포함합니다.

---

## 설정 파일 구조 (`config.json`)
하드웨어 연결 정보와 밸브 매핑은 `config.json`에서 관리합니다.

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

- `serial.baudRate` : 시리얼 포트를 열 때 사용할 보드레이트입니다.
- `maxChartDataPoints` : 그래프에 유지할 샘플 개수입니다.
- `pressureLimit` : 초과 시 비상 정지를 트리거할 압력(kPa)입니다.
- `initialValves` : 앱 시작 시 표시될 밸브 목록과 초기 상태입니다.
- `valveMappings` : UI의 밸브 이름을 실제 서보 인덱스로 매핑합니다.

---

## 시리얼 통신 프로토콜
- **명령 전송 형식** : `V,서보인덱스,상태`  
  예) `V,0,O`는 0번 서보 밸브를 연다는 의미입니다.
- **수신 데이터 형식** : `key:value` 쌍을 콤마로 구분한 문자열을 가정합니다.  
  예) `PT1:123.4,PT2:125.0`.
- **밸브 매핑** : 밸브와 서보의 매핑은 루트 디렉터리의 `config.json`에 정의합니다.

---

## 데이터 로깅
- `Header`의 로그 버튼을 누르면 `startLogging` IPC 메시지를 보내 CSV 파일을 생성합니다.  
  파일은 `Documents/rocket-log-YYYYMMDD-HHMMSS.csv` 형식으로 저장됩니다.
- 로깅 중에는 수신한 센서 값이 CSV 포맷으로 파일에 추가되며, `stopLogging` 메시지로 파일 스트림을 닫습니다.
- 로그 생성 실패 시 `log-creation-failed` 이벤트가 렌더러로 전달되어 사용자에게 알림을 표시합니다.

---

## UI 사용 방법
1. **시리얼 포트 선택** : 시작 화면에서 연결 가능한 포트 목록을 확인하고 사용할 포트를 선택합니다.
2. **포트 연결** : `Connect` 버튼을 눌러 하드웨어와 연결합니다. 연결에 성공하면 상단 상태 표시줄이 업데이트됩니다.
3. **센서 확인** : `Dashboard` 패널에서 실시간으로 들어오는 압력, 유량, 온도 데이터를 확인합니다.
4. **밸브 제어** : `Valve` 패널에서 각 밸브를 수동으로 열거나 닫을 수 있습니다.
5. **시퀀스 실행** : `Sequence` 패널에서 점화, 퍼지, 비상 정지 시퀀스를 실행합니다.
6. **로그 확인** : `Terminal` 패널에서 송수신된 데이터와 시퀀스 진행 상황을 확인합니다.

---

## 품질 검사
코드를 변경한 후에는 아래 명령으로 정적 검사를 실행해 품질을 유지하세요.

```bash
npm run lint         # ESLint 실행
npm run typecheck    # TypeScript 타입 검사
```

---

## 문제 해결
- **시리얼 포트가 보이지 않는 경우**  
  드라이버가 설치되어 있는지, 다른 프로그램이 포트를 점유하지 않았는지 확인합니다.
- **`npm run dev` 실행 시 에러가 발생하는 경우**  
  Node.js와 npm 버전이 권장 버전 이상인지 확인하고, `node_modules` 폴더를 삭제 후 다시 설치해 봅니다.
- **로그 파일이 생성되지 않는 경우**  
  쓰기 권한이 있는지 확인하고, 경로에 한글이나 공백이 없는지 점검합니다.

---

## 참고 문서
- `docs/blueprint.md`에 초기 요구사항과 디자인 가이드가 정리되어 있습니다.

---

이 README는 개발자가 데스크톱에서 안전하게 로켓 엔진을 제어할 수 있도록 현재 코드 구조와 사용 방법을 문서화한 것입니다.  
배포판이 아니므로 보안·결함에 대한 책임은 사용자에게 있습니다.

