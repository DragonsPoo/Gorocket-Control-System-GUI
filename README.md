<img width="2879" height="1700" alt="image" src="https://github.com/user-attachments/assets/ff2199ca-45b7-43f5-a146-2680b53c5f0f" />

# GOROCKET Control Suite (초보자용 상세 가이드)

`GOROCKET Control Suite`는 고로켓 팀이 액체 로켓 엔진 시험대를 보다 안전하고 효율적으로 운용하기 위해 만든 **데스크톱 제어 애플리케이션**입니다. 이 문서는 프로젝트를 처음 접하는 분들도 시스템의 모든 기능을 이해하고 활용할 수 있도록 최대한 상세하게 작성되었습니다.

이 프로그램은 USB 케이블을 이용한 **유선 시리얼 통신**만으로 센서 데이터를 수집하고 밸브를 조작하며, 점화·퍼지와 같은 자동 시퀀스를 실행할 수 있습니다. 네트워크 기능이나 사용자 인증 모듈이 포함되어 있지 않으므로, **개인 PC나 연구실과 같이 물리적으로 보안이 확보된 환경에서만 사용**해야 합니다.

## ⚠️ **매우 중요**: 안전 안내

- **실제 추진제를 사용하기 전, 반드시 물이나 모의 장비로 충분히 연습하세요.** 실제 로켓 연료는 매우 위험하며, 작은 실수가 큰 사고로 이어질 수 있습니다.
- 잘못된 설정이나 부주의한 조작은 **하드웨어 파손, 화재, 폭발 등 심각한 안전사고**로 이어질 수 있습니다.
- 본 프로젝트의 사용으로 발생하는 모든 기술적, 법적 책임은 전적으로 사용자에게 있습니다. **안전은 여러 번 강조해도 지나치지 않습니다.**

---

## 목차

1. [프로젝트 소개](#-프로젝트-소개)
    - [기술 스택](#-기술-스택)
    - [동작 원리: Main과 Renderer 프로세스](#-동작-원리-main과-renderer-프로세스)
2. [빠른 시작](#-빠른-시작)
3. [시스템 요구 사항](#-시스템-요구-사항)
4. [설치와 실행](#-설치와-실행)
5. [디렉터리 구조](#-디렉터리-구조)
6. [GUI 코드 흐름 이해하기](#-gui-코드-흐름-이해하기)
    - [데이터 흐름 요약](#-데이터-흐름-요약)
    - [프로세스 간 통신 (IPC)](#-프로세스-간-통신-ipc)
    - [핵심 로직: 커스텀 훅](#-핵심-로직-커스텀-훅)
7. [설정 파일 상세 (`config.json`)](#-설정-파일-상세-configjson)
8. [시퀀스 사용자 정의와 동작 방식](#-시퀀스-사용자-정의와-동작-방식)
9. [시리얼 통신 프로토콜](#-시리얼-통신-프로토콜)
10. [데이터 로깅](#-데이터-로깅)
11. [UI 사용 방법](#-ui-사용-방법)
12. [품질 검사와 빌드](#-품질-검사와-빌드)
13. [문제 해결](#-문제-해결)
14. [자주 묻는 질문](#-자주-묻는-질문)
15. [참고 문서 및 라이선스](#-참고-문서-및-라이선스)

---

## 🚀 프로젝트 소개

이 프로그램은 **센서 모니터링·밸브 제어·자동 시퀀스 실행**을 하나의 직관적인 화면에서 수행할 수 있도록 설계되었습니다. 사용자는 이 프로그램을 통해 로켓 엔진 테스트의 전 과정을 효과적으로 통제할 수 있습니다.

- **크로스 플랫폼 지원**: Electron 기반으로 Windows, macOS, Linux에서 모두 동일한 환경을 제공합니다.
- **다양한 계측값 표시**: 최대 4개의 압력 센서(PT), 2개의 유량 센서(Flow), 1개의 열전대(TC) 등 다양한 계측값을 실시간으로 시각화합니다.
- **자동화된 시퀀스**: 점화, 퍼지, 비상 정지(E‑Stop) 등 복잡한 과정을 버튼 하나로 정확하게 시간 순서에 따라 실행합니다.
- **데이터 후처리**: 수집된 모든 센서 데이터를 CSV 형식으로 저장하여, 테스트 후 분석 및 보고서 작성에 활용할 수 있습니다.

### 🏛️ 기술 스택

이 프로젝트는 다음과 같은 최신 웹 기술을 기반으로 만들어졌습니다.

- **Electron**: 웹 기술(HTML, CSS, JavaScript)로 데스크톱 애플리케이션을 만들 수 있게 해주는 프레임워크입니다. 운영체제의 하드웨어(시리얼 포트 등)에 접근하는 부분과 사용자 인터페이스를 분리하여 관리합니다.
- **Next.js (React)**: 사용자 인터페이스(UI)를 만드는 데 사용된 리액트 프레임워크입니다. 컴포넌트 기반 아키텍처를 통해 UI를 모듈화하여 재사용성과 유지보수성을 높입니다.
- **TypeScript**: JavaScript에 정적 타입을 추가한 언어입니다. 코드의 안정성과 가독성을 높여주며, 개발 단계에서 잠재적인 오류를 미리 발견할 수 있게 도와줍니다.

### ⚙️ 동작 원리: Main과 Renderer 프로세스

Electron 앱은 두 종류의 프로세스로 동작하며, 이를 이해하는 것이 중요합니다.

1.  **Main 프로세스 (`main.ts`)**:
    - 앱의 생명주기를 관리하고, 네이티브 OS 기능에 접근합니다.
    - 창을 생성하고, 메뉴를 설정하며, **시리얼 포트 통신**이나 **파일 시스템(데이터 로깅)**과 같은 백그라운드 작업을 처리합니다.
    - 전체 앱에서 단 하나만 실행되는 '두뇌'와 같은 역할을 합니다.

2.  **Renderer 프로세스 (`src/app/page.tsx` 등)**:
    - 사용자에게 보여지는 웹 페이지(UI)를 렌더링합니다.
    - 일반적인 웹 환경과 유사하며, 사용자의 입력(버튼 클릭 등)을 받아 처리합니다.
    - 보안상의 이유로 직접 시리얼 포트나 파일 시스템에 접근할 수 없으며, 반드시 **Main 프로세스에 요청**해야 합니다. (IPC 통신 사용)

---

## 🏁 빠른 시작

아래 순서를 따라 하면 바로 애플리케이션을 실행해 볼 수 있습니다.

1.  [시스템 요구 사항](#-시스템-요구-사항)을 만족하는지 확인합니다. 터미널에서 `node -v`와 `npm -v`로 버전을 확인하세요.
2.  이 저장소를 클론(다운로드)합니다.
    ```bash
    git clone <레포지토리 URL>
    cd Gorocket-Control-System-GUI
    ```
3.  프로젝트에 필요한 라이브러리(의존성)를 설치합니다.
    ```bash
    npm install
    ```
4.  개발 모드로 애플리케이션을 실행합니다.
    ```bash
    npm run dev
    ```
    - 9002번 포트에서 Next.js 개발 서버가 실행되고 Electron 창이 자동으로 열립니다.
5.  상단 메뉴에서 아두이노가 연결된 시리얼 포트를 선택한 뒤 `Connect` 버튼을 눌러 하드웨어와 연결합니다.
6.  센서 값과 밸브 상태가 정상적으로 표시되는지 확인하고 실험을 진행합니다.

---

## 💻 시스템 요구 사항

| 구분 | 권장 사양 | 설명 |
| --- | --- | --- |
| **운영 체제** | Windows 10 이상, macOS 13 이상, 최신 Linux 배포판 | Electron이 지원하는 OS |
| **Node.js** | 20.x 이상 | JavaScript 런타임 환경 |
| **npm** | 10.x 이상 | Node.js 설치 시 자동 포함되는 패키지 매니저 |
| **하드웨어** | 시리얼 통신이 가능한 USB 포트 및 케이블 | 아두이노 메가 등 제어 보드 연결용 |
| **Arduino IDE** | 최신 버전 | (선택) `arduino_mega_code`의 펌웨어를 수정하거나 업로드할 경우 필요 |

> **💡 Tip**: Node.js와 npm이 설치되어 있지 않다면 [Node.js 공식 사이트](https://nodejs.org/)에서 **LTS 버전**을 내려받아 설치하세요.

---

## 🛠️ 설치와 실행

### 1. 저장소 클론

Git이 설치되어 있지 않다면 [Git 공식 페이지](https://git-scm.com/)에서 설치한 뒤 아래 명령을 터미널에서 실행합니다.

```bash
git clone <레포지토리 URL>
cd Gorocket-Control-System-GUI
```

### 2. 의존성 설치

프로젝트 폴더 안에서 다음 명령을 실행하여 필요한 모든 라이브러리를 다운로드합니다.

```bash
npm install
```
- 네트워크 환경에 따라 시간이 걸릴 수 있습니다.
- 권한 문제로 실패한다면 Windows에서는 관리자 권한으로 터미널을 실행하고, macOS/Linux에서는 명령어 앞에 `sudo`를 붙여 다시 시도해 보세요. (`sudo npm install`)

### 3. 개발 모드 실행

```bash
npm run dev
```
- 이 명령은 Next.js 개발 서버를 시작하고 동시에 Electron 앱을 실행합니다.
- 코드 수정 시 화면이 자동으로 새로고침되어 편리합니다.
- 콘솔에 오류가 보이면 `node_modules` 폴더와 `package-lock.json` 파일을 삭제하고 `npm install`을 다시 실행해 보세요.

### 4. 프로덕션 빌드 생성

테스트가 완료된 배포용 버전을 만들려면 다음 명령을 사용합니다.

```bash
npm run build
```
- `dist/` 폴더에 최적화된 실행 파일과 리소스가 생성됩니다.
- 다른 PC에서 실행하려면 이 `dist` 폴더와 함께 `config.json` 파일도 반드시 함께 복사해야 합니다.

---

## 📁 디렉터리 구조

소스 코드의 전체 구조와 각 파일/폴더의 역할은 다음과 같습니다.

```
.
├── main.ts               # Electron 메인 프로세스: 앱 창 생성 및 시리얼 포트 제어
├── preload.ts            # 메인 <-> 렌더러 간 안전한 IPC 브리지
├── config.json           # 실행 시 읽어 들이는 설정 파일 (가장 먼저 확인!)
├── arduino_mega_code/    # 아두이노 메가에 업로드하는 펌웨어 소스 코드
│   └── arduino_mega_code.ino
├── main/                 # 메인 프로세스에서 사용하는 모듈
│   ├── SerialManager.ts  # 시리얼 포트 목록 조회, 연결, 데이터 송수신 처리
│   └── ...
├── src/                  # Next.js (React) UI 관련 소스 코드
│   ├── app/
│   │   └── page.tsx      # 대시보드 화면을 구성하는 메인 React 페이지
│   ├── components/       # 재사용 가능한 React UI 컴포넌트 모음 (버튼, 패널 등)
│   ├── hooks/            # 상태 관리와 핵심 로직을 담당하는 커스텀 훅
│   │   ├── useSerialManager.ts # UI의 시리얼 관련 모든 로직 통합 관리
│   │   ├── useSequenceManager.ts # 자동 시퀀스 실행 및 로그 관리
│   │   ├── useSensorData.ts    # 시리얼 메시지 파싱 및 센서/차트 데이터 저장
│   │   └── useValveControl.ts  # 밸브 상태 변경 및 리미트 스위치 반영
│   ├── lib/              # 공용 라이브러리 코드
│   ├── types/            # TypeScript 타입 정의 (데이터 구조 정의)
│   └── utils/            # 유틸리티 함수
├── package.json          # npm 스크립트 및 의존성 목록
└── ...
```

---

## 🌊 GUI 코드 흐름 이해하기

이 프로그램은 **하드웨어(Arduino) ↔ Main 프로세스 ↔ Renderer 프로세스(UI)** 순서로 데이터를 주고받습니다.

### 데이터 흐름 요약

```
[물리적 하드웨어]      <-- USB Serial -->      [Electron Main Process]      <-- IPC -->      [Electron Renderer Process (UI)]
(Arduino, 센서, 밸브)                        (main.ts, SerialManager.ts)                 (page.tsx, useSerialManager.ts)

1. Arduino: 센서 값을 읽고, 리미트 스위치 상태를 확인하여 시리얼 포트로 데이터 전송.
   "pt1:12.3,tc1:298.1,V0_LS_OPEN:1,..."

2. Main Process: 시리얼 포트로부터 데이터를 수신.
   수신한 데이터를 그대로 Renderer 프로세스로 전달. (IPC 사용)

3. Renderer Process: Main 프로세스로부터 데이터를 수신.
   useSensorData 훅이 데이터를 파싱하여 압력, 온도, 밸브 상태 등으로 변환.
   React가 변경된 데이터를 감지하여 화면의 숫자와 그래프를 자동으로 업데이트.
```

### 📞 프로세스 간 통신 (IPC)

Renderer 프로세스는 보안 정책상 직접 하드웨어에 접근할 수 없습니다. 따라서 `preload.ts`를 통해 Main 프로세스가 제공하는 기능만 안전하게 호출할 수 있습니다. `window.electronAPI`라는 객체를 통해 다음과 같은 작업이 이루어집니다.

| IPC 채널 (요청) | 설명 | 호출 예시 (Renderer) | 처리 주체 (Main) |
| --- | --- | --- | --- |
| `get-serial-ports` | 사용 가능한 시리얼 포트 목록을 요청합니다. | `window.electronAPI.getSerialPorts()` | `SerialManager` |
| `connect-serial` | 특정 포트로 연결을 시도합니다. | `window.electronAPI.connectSerial('COM3')` | `SerialManager` |
| `disconnect-serial`| 연결을 해제합니다. | `window.electronAPI.disconnectSerial()` | `SerialManager` |
| `send-to-serial` | 밸브 제어 등 명령어를 하드웨어로 전송합니다. | `window.electronAPI.sendToSerial('V,0,O')` | `SerialManager` |
| `get-config` | `config.json` 파일의 내용을 읽어옵니다. | `window.electronAPI.getConfig()` | `ConfigManager` |
| `start-logging` | CSV 데이터 로깅을 시작합니다. | `window.electronAPI.startLogging()` | `LogManager` |

### 🧠 핵심 로직: 커스텀 훅

UI의 복잡한 상태 관리와 로직은 React의 **커스텀 훅**으로 분리되어 있습니다.

-   **`useSerialManager.ts`**: 전체적인 조율자 역할. UI 컴포넌트와 다른 훅들을 연결합니다. 포트 연결/해제, 명령어 전송, 수신 데이터 분배 등 대부분의 상호작용을 총괄합니다.
-   **`useSensorData.ts`**: 데이터 처리 전문가. `main.ts`에서 받은 순수 문자열(`pt1:12.3,...`)을 파싱하여 의미 있는 데이터(숫자, 상태 등)로 변환하고, 차트에 표시할 데이터를 저장합니다. 압력 한계 초과 시 비상 정지 시퀀스를 호출하는 로직도 담당합니다.
-   **`useValveControl.ts`**: 밸브 전문가. 밸브의 개폐 상태와 리미트 스위치 상태를 관리합니다. 사용자가 UI에서 밸브 버튼을 클릭하면 이 훅이 적절한 시리얼 명령을 생성하여 `useSerialManager`에 전달합니다.
-   **`useSequenceManager.ts`**: 시퀀스 실행 전문가. 점화, 퍼지 등 미리 정의된 작업 단계를 순서대로 실행하고, 각 단계의 로그를 터미널에 출력합니다.

---

## 📄 설정 파일 상세 (`config.json`)

애플리케이션은 실행 시 `config.json`을 읽어 센서와 밸브 구성, 안전 한계값 등을 설정합니다. 이 파일을 수정하여 자신의 하드웨어에 맞게 프로그램을 커스터마이징할 수 있습니다.

```json
{
  "serial": {
    "baudRate": 115200
  },
  "maxChartDataPoints": 100,
  "pressureLimit": 850,
  "initialValves": [
    { "id": 1, "name": "Ethanol Main", "state": "CLOSED", "lsOpen": false, "lsClosed": false },
    { "id": 2, "name": "N2O Main", "state": "CLOSED", "lsOpen": false, "lsClosed": false },
    { "id": 3, "name": "Ethanol Purge", "state": "CLOSED", "lsOpen": false, "lsClosed": false }
  ],
  "valveMappings": {
    "Ethanol Main": { "servoIndex": 0 },
    "N2O Main": { "servoIndex": 1 },
    "Ethanol Purge": { "servoIndex": 2 }
  }
}
```

-   `serial.baudRate`: 시리얼 포트 통신 속도. **Arduino 펌웨어의 `Serial.begin()` 값과 반드시 일치해야 합니다.**
-   `maxChartDataPoints`: 차트에 표시할 데이터 포인트의 최대 개수. 이 값을 넘으면 가장 오래된 데이터부터 사라집니다.
-   `pressureLimit`: PSI 단위의 압력 상한값. 센서에서 이 값 이상의 압력이 감지되면 **자동으로 비상 정지 시퀀스가 실행됩니다.**
-   `initialValves`: UI에 표시할 밸브 목록과 초기 상태 정의.
    -   `id`: 밸브의 고유 식별자.
    -   `name`: UI에 표시될 밸브 이름.
    -   `state`: 초기 상태 (`"OPEN"` 또는 `"CLOSED"`).
    -   `lsOpen`, `lsClosed`: 리미트 스위치의 초기 상태 (UI 표시용, 보통 `false`로 둠).
-   `valveMappings`: UI의 밸브 이름(`name`)과 Arduino 펌웨어의 서보 모터 인덱스(`servoIndex`)를 연결합니다. 예를 들어, "Ethanol Main" 밸브를 제어하면 실제로는 `servoIndex` 0번 모터에 명령이 전달됩니다.

---

## 📜 시퀀스 사용자 정의와 동작 방식

자동 시퀀스는 `src/hooks/useSequenceManager.ts` 파일에 정의되어 있습니다. 각 시퀀스는 다음과 같은 **단계(Step) 객체의 배열**로 구성됩니다.

```ts
interface SequenceStep {
  message: string;    // 터미널 로그에 표시할 메시지
  delay: number;      // 이전 단계 실행 후 대기할 시간 (밀리초 단위, 1000ms = 1초)
  action?: () => void; // 실행할 함수 (주로 밸브 제어 명령 전송)
}
```

`handleSequence("Ignition Sequence")`와 같이 호출하면, `runSequence` 함수가 배열의 각 단계를 순서대로 실행합니다. `delay`만큼 기다린 후, `action`을 실행하고 `message`를 터미널에 기록합니다.

### 새로운 시퀀스 추가 예시

1.  `useSequenceManager.ts` 파일의 `sequences` 객체에 새로운 시퀀스를 추가합니다.
2.  실행할 단계들을 배열로 작성합니다. `sendCommand`를 사용하여 밸브를 제어합니다.

```ts
// 예시: 2초간 연료 퍼지를 수행하는 시퀀스
'Fuel Purge': [
  { message: 'Opening Ethanol Purge valve...', delay: 0, action: () => handleValveChange(3, 'OPEN') },
  { message: 'Purging for 2 seconds...', delay: 2000 },
  { message: 'Closing Ethanol Purge valve.', delay: 0, action: () => handleValveChange(3, 'CLOSED') },
  { message: 'Fuel Purge sequence complete.', delay: 500 }
],
```
3. `src/components/dashboard/sequence-panel.tsx` 파일에 새 버튼을 추가하여 이 시퀀스를 호출할 수 있도록 합니다.

---

## 📡 시리얼 통신 프로토콜

하드웨어(Arduino)와 GUI 프로그램은 텍스트 기반의 시리얼 통신을 사용합니다. 프로토콜은 매우 간단합니다.

### GUI → Arduino (명령 전송)

| 목적 | 형식 | 예시 | 설명 |
| --- | --- | --- | --- |
| 밸브 제어 | `V,서보인덱스,상태` | `V,0,O` | 0번 서보를 Open(열림) 상태로 만듭니다. |
| | | `V,1,C` | 1번 서보를 Close(닫힘) 상태로 만듭니다. |

- `서보인덱스`는 `config.json`의 `valveMappings`에 정의된 숫자입니다.
- `상태`는 `O`(Open) 또는 `C`(Close) 중 하나입니다.

### Arduino → GUI (데이터 수신)

Arduino는 주기적으로 모든 센서와 리미트 스위치 상태를 한 줄의 문자열로 만들어 전송합니다. 각 데이터는 `키:값` 쌍으로 구성되며 콤마(`,`)로 구분됩니다.

- **전송 형식**: `pt1:값,pt2:값,...,tc1:값,V0_LS_OPEN:상태,V0_LS_CLOSED:상태,...`
- **실제 예시**: `pt1:14.52,pt2:15.10,pt3:0.00,pt4:0.00,tc1:298.15,V0_LS_OPEN:0,V0_LS_CLOSED:1,V1_LS_OPEN:0,V1_LS_CLOSED:1`

| 키 | 설명 | 값 예시 |
| --- | --- | --- |
| `pt1` ~ `pt4` | 압력 센서(Pressure Transducer) 1~4번의 값 (PSI 단위) | `14.52` |
| `tc1` | 열전대(Thermocouple) 1번의 값 (절대온도 K 단위) | `298.15` |
| | 열전대 연결 오류 | `OPEN_ERR` |
| | 열전대 통신 오류 | `COM_ERR` |
| `V0_LS_OPEN` | 0번 서보의 '열림' 리미트 스위치 상태 (0: 꺼짐, 1: 켜짐) | `1` |
| `V0_LS_CLOSED`| 0번 서보의 '닫힘' 리미트 스위치 상태 (0: 꺼짐, 1: 켜짐) | `0` |

---

## 💾 데이터 로깅

- 상단 `Start Logging` 버튼을 누르면 내 문서 폴더에 `rocket-log-YYYYMMDD-HHMMSS.csv` 형식의 파일이 생성됩니다.
- 로깅 중에는 수신한 센서 값이 실시간으로 CSV 파일에 추가됩니다.
- `Stop Logging`을 누르거나 프로그램을 종료하면 파일 저장이 완료됩니다.
- 파일 생성에 실패하면 화면에 오류 메시지가 표시됩니다.

CSV 파일의 헤더(첫 줄)는 다음과 같이 고정되어 있습니다.

```
timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1
```
> **참고**: 현재 펌웨어(`arduino_mega_code.ino`)는 유량 센서(flow1, flow2) 데이터를 전송하지 않으므로 해당 열은 비어있을 수 있습니다.

---

## 🎨 UI 사용 방법

1.  **시리얼 포트 선택 및 연결**: 앱 실행 후 상단 드롭다운에서 Arduino가 연결된 포트를 선택하고 `Connect`를 클릭합니다.
2.  **센서 데이터 확인**: `Dashboard` 패널에서 각 센서 값을 숫자와 그래프로 실시간 확인합니다.
3.  **수동 밸브 제어**: `Valve Control & Status` 패널에서 각 밸브 버튼을 클릭해 수동으로 개폐합니다. 버튼 아래의 `O`/`C` 표시등은 리미트 스위치의 현재 상태를 나타냅니다.
4.  **자동 시퀀스 실행**: `Sequence` 패널에서 점화, 퍼지 등 원하는 시퀀스 버튼을 클릭하여 실행합니다.
5.  **로그 터미널 활용**: 모든 통신 내용과 시퀀스 진행 상황이 `Terminal` 패널에 출력됩니다. 문제 발생 시 원인 파악에 유용합니다.

---

## ✅ 품질 검사와 빌드

코드를 수정한 후에는 다음 명령으로 코드 품질을 검사하고 타입 오류가 없는지 확인하는 것이 좋습니다.

```bash
npm run lint         # ESLint 규칙 검사
npm run typecheck    # TypeScript 타입 검사
```

검사가 통과하면 `npm run build`로 배포용 파일을 생성할 수 있습니다. 시리얼 포트 모듈이 제대로 빌드되지 않는 경우, `npm run rebuild`를 실행하여 네이티브 모듈을 다시 컴파일할 수 있습니다.

---

## 🚑 문제 해결

- **시리얼 포트가 목록에 표시되지 않음**:
  - Arduino가 PC에 제대로 연결되었는지 확인하세요.
  - 필요한 USB 드라이버(예: CH340)가 설치되었는지 확인하세요.
  - Arduino IDE의 시리얼 모니터 등 다른 프로그램이 포트를 사용 중인지 확인하고, 사용 중이라면 종료하세요.
- **`npm run dev` 실행 시 오류 발생**:
  - Node.js와 npm 버전이 요구 사항을 만족하는지 확인하세요.
  - `node_modules` 폴더와 `package-lock.json` 파일을 삭제한 후 `npm install`을 다시 실행해 보세요.
- **로그 파일이 생성되지 않음**:
  - 프로그램이 '내 문서' 폴더에 파일을 쓸 권한이 있는지 확인하세요. (특히 macOS 및 Linux)

---

## ❓ 자주 묻는 질문

- **Q. 원격 제어나 네트워크 기능을 지원하나요?**
  - A. 아니요. 이 프로젝트는 안전을 최우선으로 고려하여 물리적으로 연결된 시리얼 통신만 지원합니다.
- **Q. 새로운 센서나 밸브를 추가하려면 어떻게 해야 하나요?**
  - A. 1) `arduino_mega_code.ino` 펌웨어를 수정하여 새 하드웨어를 제어하는 코드를 추가합니다. 2) `config.json`에 새 밸브나 센서 정보를 추가합니다. 3) `src/hooks`와 `src/components`의 관련 UI 코드를 수정하여 새 데이터를 표시하고 제어하는 로직을 추가합니다.
- **Q. 자동 시퀀스를 완전히 새로 만들 수 있나요?**
  - A. 네, [시퀀스 사용자 정의와 동작 방식](#-시퀀스-사용자-정의와-동작-방식) 섹션을 참고하여 `useSequenceManager.ts` 파일에 원하는 동작을 정의하면 자신만의 시퀀스를 만들 수 있습니다.

---

## 📚 참고 문서 및 라이선스

- `docs/blueprint.md`에 프로젝트의 초기 요구 사항과 디자인 가이드가 정리되어 있습니다.
- 소스 코드는 [MIT 라이선스](LICENSE)에 따라 자유롭게 사용할 수 있습니다. 단, 실사용에 따른 모든 책임은 전적으로 사용자에게 있습니다.

---

이 README는 처음 프로젝트를 접하는 분도 **시리얼 통신 기반 GUI 제어 시스템**의 전체 흐름을 이해하고 자신의 목적에 맞게 수정·확장할 수 있도록 최대한 자세히 작성되었습니다. 문서를 참고하여 안전하고 효율적인 실험 환경을 구축하시기 바랍니다.
