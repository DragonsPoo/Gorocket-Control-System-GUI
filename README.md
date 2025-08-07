<img width="2879" height="1707" alt="image" src="https://github.com/user-attachments/assets/c90cc718-bac5-4cd8-a8b0-35ad40c5e9c1" />

# 로켓 엔진 테스트용 제어 및 모니터링 GUI

## 소개

이 프로젝트는 로켓 엔진 테스트 스탠드(Test Stand)를 안전하고 직관적으로 운용하기 위한 데스크톱 애플리케이션입니다. Electron을 기반으로 한 멀티플랫폼 앱이며, Next.js와 React를 활용해 인터페이스를 구성했습니다. 초보자도 간단한 설치 과정만 거치면 GUI에서 센서 값을 확인하고 밸브를 제어할 수 있습니다.

### 사용 기술
- **Electron**: 데스크톱 애플리케이션 프레임워크
- **Next.js / React**: 프론트엔드 UI 구현
- **TypeScript & C++**: 애플리케이션과 펌웨어에 사용된 언어
- **Tailwind CSS, shadcn/ui**: 스타일링
- **Recharts**: 센서 데이터 시각화
- **node-serialport**: 하드웨어 시리얼 통신
- **Arduino**: 펌웨어 실행 보드

---

## 주요 기능

- **실시간 센서 모니터링**
  - 4개의 압력 센서(PT), 2개의 유량 센서, 2개의 열전대(TC) 데이터를 초당 여러 번 수신합니다.
  - 수신된 데이터는 대시보드의 숫자 패널과 시계열 차트로 즉시 확인할 수 있습니다.

- **밸브 제어 및 상태 피드백**
  - 총 7개의 서보 밸브를 개별적으로 열고 닫을 수 있습니다.
  - 각 밸브에는 2개의 리미트 스위치가 부착되어 있어 열림/닫힘 상태를 실시간으로 표시합니다.

- **자동 테스트 시퀀스**
  - 퍼지, 점화, 메인 연소 등 미리 정의된 단계를 버튼 한 번으로 실행합니다.
  - 실행 과정과 결과는 터미널 패널에 순서대로 기록됩니다.

- **데이터 로깅**
  - 모든 센서 데이터를 타임스탬프와 함께 CSV 파일로 저장합니다.
  - 로깅 시작과 종료를 GUI에서 제어할 수 있으며, 저장된 파일은 후처리와 분석에 활용됩니다.

- **안정적인 하드웨어 통신**
  - 연결 가능한 시리얼 포트를 자동으로 검색하여 목록으로 제공합니다.
  - 사용자가 포트를 선택하면 연결 여부가 UI에 명확히 표시됩니다.

---

## 시스템 아키텍처

이 애플리케이션은 세 개의 레이어로 구성됩니다.

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

- **UI Layer (Frontend)**  
  `src` 디렉터리에 위치하며 Next.js와 React로 작성되었습니다. `preload.ts`가 제공하는 IPC 인터페이스를 통해 메인 프로세스와 통신하며, 데이터를 시각화하고 사용자 입력을 받습니다.

- **Main Process Layer (Backend)**  
  `main.ts`와 `main/` 디렉터리에 위치한 Electron 메인 프로세스입니다. 시리얼 포트 관리, 데이터 로깅, 설정 파일 로드 등을 수행하며 Arduino와 직접 통신합니다.

- **Hardware Layer (Device)**  
  `arduino_mega_code/`에 포함된 Arduino Mega 펌웨어로 센서를 읽고 서보 모터를 제어합니다. 메인 프로세스로부터 명령을 받고 측정된 데이터를 주기적으로 전송합니다.

---

## 파일 구조

```
.
├── arduino_mega_code/     # Arduino 펌웨어
├── main/                  # Electron 메인 프로세스 모듈
├── src/                   # Next.js/React 프론트엔드 코드
│   ├── app/               # 페이지와 레이아웃
│   ├── components/        # 재사용 가능한 UI 컴포넌트
│   ├── hooks/             # 커스텀 React 훅
│   └── types/             # 공용 타입 정의
├── docs/                  # 참고 문서와 설계 자료
├── main.ts                # 메인 프로세스 진입점
├── preload.ts             # Renderer와 Main을 잇는 브리지
├── config.json            # 사용자 설정 파일
└── package.json           # 의존성 및 실행 스크립트
```

---

## 개발 환경 준비

### 1. 필수 소프트웨어 설치
- [Node.js](https://nodejs.org/) 18 버전 이상
- [Arduino IDE](https://www.arduino.cc/en/software)
- Git (선택 사항이지만 권장)

설치 후 버전을 확인합니다.
```bash
node -v
npm -v
```

### 2. 저장소 클론 및 의존성 설치
```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

### 3. 네이티브 모듈 재빌드
`serialport`는 C++ 모듈을 포함하므로 사용 중인 Electron 버전에 맞게 다시 빌드해야 합니다.
```bash
npm run rebuild
```
Windows 환경에서 오류가 발생하면 `windows-build-tools` 또는 `node-gyp` 관련 설정이 필요할 수 있습니다.

### 4. Arduino 펌웨어 업로드
1. Arduino IDE를 실행합니다.
2. `arduino_mega_code/arduino_mega_code.ino` 파일을 엽니다.
3. **툴 > 보드**에서 `Arduino Mega or Mega 2560`을 선택합니다.
4. PC에 연결된 보드의 시리얼 포트를 선택합니다.
5. 업로드 버튼을 눌러 펌웨어를 보드에 탑재합니다.

---

## 실행 방법

### 개발 모드
Next.js 개발 서버와 Electron을 동시에 실행하며 코드 변경 시 자동으로 새로고침됩니다.
```bash
npm run dev
```

### 프로덕션 빌드
배포용 실행 파일을 생성합니다.
```bash
npm run build
```
생성된 설치 파일은 `release/` 디렉터리에 위치합니다.

---

## 설정 파일 (`config.json`)

애플리케이션의 주요 동작은 `config.json`에서 제어됩니다.

```json
{
  "serial": { "baudRate": 115200 },
  "maxChartDataPoints": 100,
  "pressureLimit": 850,
  "initialValves": [
    { "id": 1, "name": "Ethanol Main", "state": "CLOSED" }
  ],
  "valveMappings": {
    "Ethanol Main": { "servoIndex": 0 }
  }
}
```

- `serial.baudRate`: Arduino와 통신할 시리얼 속도로 펌웨어와 일치해야 합니다.
- `maxChartDataPoints`: 차트에 표시할 데이터 포인트의 최대 개수입니다.
- `pressureLimit`: 압력 경고 기준값(PSI).
- `initialValves`: 시작 시 표시할 밸브 목록과 기본 상태입니다.
- `valveMappings`: UI에서 사용되는 밸브 이름을 펌웨어의 서보 인덱스와 매핑합니다.

---

## 문제 해결 팁
- `npm run rebuild` 중 에러가 발생하면 컴파일 도구 설치 여부(`node-gyp`, `python`, `make` 등)를 확인하세요.
- 시리얼 포트가 보이지 않는다면 케이블 연결 상태를 확인하고, 운영체제 드라이버가 설치되어 있는지 점검합니다.

---

이 문서는 프로젝트의 기본 사용법을 안내합니다. 개선 사항이나 버그 제보는 이슈로 등록해 주세요.
