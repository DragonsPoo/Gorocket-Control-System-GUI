# 로켓 엔진 테스트용 제어 및 모니터링 GUI

## 1. 개요 (Overview)

본 프로젝트는 로켓 엔진 테스트 스탠드(Test Stand)의 제어 및 모니터링을 위해 개발된 데스크톱 애플리케이션입니다. Electron을 기반으로 구축되었으며, Next.js와 React를 사용하여 사용자 인터페이스를 구현했습니다. 실시간으로 하드웨어의 센서 데이터를 수신하여 시각화하고, 밸브 제어 및 자동화된 테스트 시퀀스 실행 기능을 제공합니다.

### 주요 기술 스택
- **프레임워크**: Electron, Next.js (React)
- **언어**: TypeScript, C++ (Arduino)
- **스타일링**: Tailwind CSS, shadcn/ui
- **차트**: Recharts
- **하드웨어 통신**: `node-serialport`
- **펌웨어**: Arduino

---

## 2. 주요 기능 (Key Features)

- **실시간 센서 모니터링**:
    - 4개의 압력 센서(PT)와 1개의 열전대(TC)로부터 데이터를 실시간으로 수신하여 표시합니다.
    - 데이터는 숫자 패널과 시계열 차트를 통해 직관적으로 확인할 수 있습니다.

- **밸브 제어 및 상태 피드백**:
    - 총 7개의 서보 밸브를 개별적으로 열고 닫을 수 있습니다.
    - 각 밸브의 실제 개폐 상태를 리미트 스위치(Limit Switch)를 통해 피드백 받아 UI에 표시합니다.

- **자동 테스트 시퀀스**:
    - 사전 정의된 명령 시퀀스(예: 퍼지, 점화, 메인 연소)를 버튼 클릭만으로 실행할 수 있습니다.
    - 시퀀스 실행 중 발생하는 모든 이벤트와 명령어는 터미널 패널에 기록됩니다.

- **데이터 로깅**:
    - 수신되는 모든 센서 데이터를 타임스탬프와 함께 CSV 파일로 저장하는 기능을 제공합니다.
    - 로깅 시작/중지 제어가 가능하며, 데이터는 후처리 및 분석에 활용될 수 있습니다.

- **안정적인 하드웨어 통신**:
    - 사용 가능한 시리얼 포트를 자동으로 감지하고, 사용자가 포트를 선택하여 장치에 연결할 수 있습니다.
    - 연결 상태가 UI에 명확하게 표시되어 안정적인 운영을 지원합니다.

---

## 3. 시스템 아키텍처 (System Architecture)

이 시스템은 다음과 같은 3개의 주요 레이어로 구성됩니다.

```
+--------------------------------+
|       UI Layer (Frontend)      |
|  (Next.js / React / TypeScript)|
+--------------------------------+
             ^      | IPC
             |      v
+--------------------------------+
|  Main Process Layer (Backend)  |
|   (Electron / Node.js / TS)    |
+--------------------------------+
             ^      | Serial
             |      v
+--------------------------------+
|      Hardware Layer (Device)   |
|         (Arduino Mega)         |
+--------------------------------+
```

1.  **UI Layer (Frontend)**:
    -   `src` 디렉토리에 위치하며, Next.js와 React로 구현되었습니다.
    -   사용자에게 데이터를 시각화하고 제어 인터페이스를 제공합니다.
    -   Electron의 `preload.ts` 스크립트를 통해 Main Process와 IPC(Inter-Process Communication) 통신을 수행합니다.

2.  **Main Process Layer (Backend)**:
    -   `main.ts` 및 `main/` 디렉토리에 위치하며, Electron의 주 프로세스입니다.
    -   Node.js 환경에서 실행되며, 시리얼 포트 관리, 데이터 로깅, 설정 파일 로드 등 백엔드 로직을 담당합니다.
    -   Arduino와 시리얼 통신을 통해 데이터를 주고받으며, 이를 UI Layer로 전달합니다.

3.  **Hardware Layer (Device)**:
    -   `arduino_mega_code` 디렉토리에 위치한 펌웨어 코드입니다.
    -   Arduino Mega 보드에서 실행되며, 센서 값을 읽고 서보 모터를 제어합니다.
    -   Main Process로부터 제어 명령을 수신하고, 측정된 센서 데이터를 주기적으로 전송합니다.

---

## 4. 파일 구조 (File Structure)

```
.
├── arduino_mega_code/  # Arduino Mega 펌웨어 소스 코드
│   └── arduino_mega_code.ino
├── main/               # Electron Main Process 관련 모듈
│   ├── ConfigManager.ts
│   ├── LogManager.ts
│   └── SerialManager.ts
├── src/                # Next.js 프론트엔드 소스 코드
│   ├── app/            # 페이지 및 레이아웃
│   ├── components/     # React 컴포넌트 (UI 요소)
│   ├── hooks/          # 커스텀 React Hooks (상태 관리 로직)
│   └── types/          # TypeScript 타입 정의
├── main.ts             # Electron Main Process 진입점
├── preload.ts          # Electron Preload 스크립트 (IPC 브릿지)
├── config.json         # 애플리케이션 설정 파일
└── package.json        # 프로젝트 의존성 및 스크립트
```

---

## 5. 설치 및 설정 (Installation and Setup)

### 사전 요구사항
-   [Node.js](https://nodejs.org/) (v18 이상 권장)
-   [Arduino IDE](https://www.arduino.cc/en/software)

### 설치 과정
1.  **저장소 복제**:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Node.js 의존성 설치**:
    ```bash
    npm install
    ```

3.  **네이티브 모듈 재빌드**:
    `serialport` 모듈은 C++ 바인딩을 사용하므로, 현재 시스템의 Electron 버전에 맞게 재빌드가 필요합니다.
    ```bash
    npm run rebuild
    ```
    *이 과정에서 오류 발생 시, `windows-build-tools` 또는 `node-gyp` 관련 설정이 필요할 수 있습니다.*

4.  **Arduino 펌웨어 업로드**:
    1.  Arduino IDE를 엽니다.
    2.  `arduino_mega_code/arduino_mega_code.ino` 파일을 엽니다.
    3.  **툴 > 보드** 메뉴에서 `Arduino Mega or Mega 2560`을 선택합니다.
    4.  PC에 연결된 Arduino의 시리얼 포트를 선택합니다.
    5.  `업로드` 버튼을 눌러 펌웨어를 보드에 업로드합니다.

---

## 6. 실행 방법 (Usage)

### 개발 모드 실행
프론트엔드(Next.js)와 백엔드(Electron)를 동시에 실행하며, 코드 변경 시 자동 새로고침이 적용됩니다.
```bash
npm run dev
```

### 프로덕션 빌드
배포 가능한 실행 파일(Windows의 경우 `.exe`)을 생성합니다.
```bash
npm run build
```
빌드가 완료되면 `release/` 디렉토리에 설치 파일이 생성됩니다.

---

## 7. 설정 (Configuration)

애플리케이션의 주요 동작은 `config.json` 파일을 통해 설정할 수 있습니다.

```json
{
  "serial": {
    "baudRate": 115200
  },
  "maxChartDataPoints": 100,
  "pressureLimit": 850,
  "initialValves": [
    { "id": 1, "name": "Ethanol Main", "state": "CLOSED", ... },
    ...
  ],
  "valveMappings": {
    "Ethanol Main": { "servoIndex": 0 },
    ...
  }
}
```

-   `serial.baudRate`: Arduino와의 시리얼 통신 속도 (펌웨어와 일치해야 함).
-   `maxChartDataPoints`: 차트에 표시할 최대 데이터 포인트 수.
-   `pressureLimit`: 압력 경고 기준값 (단위: PSI).
-   `initialValves`: UI에 표시될 밸브의 초기 이름과 상태 목록.
-   `valveMappings`: UI의 밸브 이름과 Arduino 펌웨어의 서보 인덱스를 매핑.
