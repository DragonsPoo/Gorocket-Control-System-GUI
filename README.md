<img width="2879" height="1700" alt="스크린샷 2025-08-18 151005" src="https://github.com/user-attachments/assets/8317575d-080e-4031-ace6-903a784e9e98" />
<img width="1863" height="1197" alt="image" src="https://github.com/user-attachments/assets/e83a5563-57d6-49ee-b93e-51e1906644c7" />

# GoRocket Control System GUI — 지상 시험 운영 매뉴얼

버전: 2.6.0 (Electron 37 / Next.js 15 / TypeScript 5)

이 문서는 지상 기반 액체 로켓 엔진 시험에 사용되는 GoRocket Control System GUI의 최종적이고 포괄적인 운영 매뉴얼입니다. 이 매뉴얼은 시스템의 기본 개념, 엔드-투-엔드 데이터 흐름, 안전 메커니즘, 화면상의 작업 흐름, 그리고 시스템을 자신감 있게 운영하는 데 필요한 유지보수 작업을 설명합니다. 이 매뉴얼과 설치된 GUI만 있으면, 프로젝트에 새로 참여하는 운영자도 시험대를 설치, 준비(ARM), 운영하고 안전하게 종료할 수 있습니다.

중요: 이 GUI는 유선 USB 직렬 링크를 통해 `arduino_mega_code/`에 포함된 짝을 이루는 펌웨어를 실행하는 아두이노 메가 2560에 연결됩니다. 이 소프트웨어는 안전을 최우선으로 하는 지상 시험을 위해 설계되었습니다. 물리적 비상 정지(E-stop), 압력 방출 하드웨어, 그리고 훈련된 인원은 항상 필수입니다.

## 목차

1.  안전 원칙 및 책임
2.  시스템 개요 및 아키텍처
3.  하드웨어 및 배선 체크리스트
4.  직렬 프로토콜 및 원격 측정(텔레메트리)
5.  안전 메커니즘 및 타이밍 특성
6.  소프트웨어 설치 및 실행 (Windows)
7.  사용자 인터페이스 둘러보기 및 운영 워크플로우
8.  로깅, 파일 아티팩트 및 데이터 보존
9.  설정: `config.json` (밸브 매핑, 제한, 피드백)
10. 시퀀스: 개념, 작성, 검증 (`sequences.json`)
11. 밸브 매핑 및 시퀀스를 안전하게 변경하는 방법
12. 문제 해결 및 일반적인 문제
13. 빌드, 패키징 및 테스트 (유지보수 담당자용)
14. 참조 부록
15. IPC 및 이벤트 참조
16. 코드 경로 둘러보기
17. 상태 머신

## 1) 안전 원칙 및 책임

*   **목적**: 이 GUI는 지상 시험을 위한 감독 제어 및 모니터링 도구입니다. 소프트웨어 수준의 안전 조치(ARM 게이팅, 비상 페일세이프, 압력 경보)를 강제하지만, 물리적 안전 시스템이나 절차를 대체할 수는 없습니다.
*   **필수 사항**: 물리적 비상 정지(E-stop), 릴리프 밸브, 명확한 안전 경계, 통신 프로토콜, 그리고 훈련된 인원이 반드시 있어야 합니다. 시험 당일 체크리스트와 런북을 따르십시오.
*   **위험 감수**: 자격을 갖춘 운영자만이 ARM(준비)하고 제어 명령을 보낼 수 있습니다. ARM하기 전에 항상 하드웨어를 재확인하십시오. 코드를 임의로 수정하거나 설정을 변경하여 안전 장치를 우회해서는 안 됩니다.
*   **주요 비상 메커니즘**: 하드웨어 비상 정지(E-stop). GUI는 또한 자동 및 운영자 트리거 소프트웨어 페일세이프 루틴을 사용합니다.

## 2) 시스템 개요 및 아키텍처

**고수준 구성 요소:**

*   **Electron 메인 프로세스 (`main.ts`):**
    *   설정 및 시퀀스를 로드하고, 안전 정책(ARM 게이팅)을 강제하며, SerialManager를 소유합니다.
    *   SequenceEngine(시퀀스 실행), HeartbeatDaemon(주기적 HB), LogManager(세션 로그), SequenceDataManager(JSON 유효성 검사 + 드라이런 검사)를 호스팅합니다.
    *   샌드박스 처리된 프리로드를 통해 렌더러(Renderer)와 IPC 브릿지 역할을 합니다.

*   **렌더러 (src/ 아래의 Next.js UI):**
    *   센서, 밸브 상태, 차트, 시퀀스 UI, 연결 및 ARM 제어를 표시합니다.
    *   직렬 명령, 시퀀스, 안전 및 로깅을 위해 `window.electronAPI`(프리로드 브릿지)를 통해 메인 프로세스와 통신합니다.

*   **프리로드 브릿지 (`preload.ts`):**
    *   안전하고 타입이 지정된 함수들을 `window.electronAPI`에 노출합니다 (예: `listSerialPorts`, `connectSerial`, `sequenceStart`, `safetyTrigger`, `startLogging`).

*   **SerialManager (`main/SerialManager.ts`):**
    *   직렬 포트를 관리하고, 명령을 프레이밍하며, 타임아웃 및 재시도를 통해 ACK/NACK를 추적하고, 우선순위 처리로 명령을 큐에 넣고, 실패 시 재연결합니다.

*   **SequenceEngine (`main/SequenceEngine.ts`):**
    *   단계 기반 시퀀스(cmd/wait)를 실행하고, 피드백 대기 및 압력 대기를 디바운스와 함께 수행하며, 오류 발생 시 페일세이프 루틴을 트리거합니다.

*   **HeartbeatDaemon (`main/HeartbeatDaemon.ts`):**
    *   주기적으로 "HB" 핑을 MCU로 보내며, 펌웨어 측의 빠른 ARM을 위해 연결 시 즉시 HB를 포함합니다.

*   **LogManager (`main/LogManager.ts`):**
    *   타임스탬프가 찍힌 세션 폴더를 생성하고, 설정 및 시퀀스를 스냅샷하며, CSV 원격 측정/밸브 상태를 기록하고, 상태 이벤트를 표시하며, 주기적으로 fsync를 수행합니다.

*   **SequenceDataManager (`main/SequenceDataManager.ts`):**
    *   Ajv를 사용하여 `sequences.json`을 `sequences.schema.json`에 대해 유효성을 검사하고, 위험한 패턴을 차단하기 위해 정적 및 드라이런 검사를 실행합니다.

*   **펌웨어 (Arduino Mega 2560):**
    *   CRC 프레임 명령을 수신하고, 서보(밸브)를 작동시키며, 리미트 스위치를 확인하고, 압력/유량/온도를 측정하고, CRC로 보호된 원격 측정 데이터를 방출하며, EMERG/TRIP 규칙을 강제하고, ACK/NACK로 응답합니다.

**데이터 흐름 (단순화):**

렌더러 UI → 프리로드 (IPC) → Electron 메인 → SerialManager → 아두이노 메가
아두이노 원격 측정/상태 → SerialManager → Electron 메인 → 렌더러 UI → 운영자

## 3) 하드웨어 및 배선 체크리스트

*   **호스트 PC**: Windows 10/11, 사용 가능한 USB 포트, Node.js 20+ (개발용), 운영용으로 패키징된 Electron 런타임.
*   **아두이노 메가 2560**: 검증된 보드 및 USB 케이블.
*   **서보 배선**: 인덱스 0-6에 매핑된 7개의 서보; 배선은 펌웨어의 `servoPins[]`와 일치해야 합니다.
*   **리미트 스위치**: 밸브당 쌍을 이루는 OPEN/CLOSED 입력; 상시 열림/닫힘 상태가 펌웨어 배선 및 로직과 일치하는지 확인합니다.
*   **압력 센서**: A0-A3에 연결된 1-4개의 센서 (펌웨어 단위 psi로 보정됨).
*   **유량 센서**: 2개의 펄스 센서 (D2 INT0, D3 INT1), 디바운스 및 EWMA 구현됨.
*   **열전대**: SPI의 MAX6675 모듈 (핀은 펌웨어에 문서화됨).
*   **안전**: 물리적 비상 정지(E-stop)에 접근 가능하고 테스트 완료. 릴리프 경로 기능 확인.
*   **전원**: 서보 및 센서를 위한 안정적인 공급; 작동 시 전압 강하(brownout) 방지.

## 4) 직렬 프로토콜 및 원격 측정(텔레메트리)

**명령 프레이밍 (MCU로):**

*   텍스트 라인, 개행 문자로 종료 `
`.
*   프레임 형식: `payload,msgId,crcHex`
    *   `payload`: 예: `V,4,O` (밸브 #4 열림), `HB`, `HELLO`, `SAFE_CLEAR`
    *   `msgId`: 정수 (송신자가 할당)
    *   `crcHex`: `payload,msgId`의 ASCII에 대한 CRC-8의 2자리 대문자 16진수.
*   **ACK/NACK 응답:**
    *   `ACK,<msgId>`
    *   `NACK,<msgId>,<REASON>` (예: `NACK,42,BUSY`, `NACK,42,CRC_FAIL`)

**일반적인 페이로드:**

*   `HELLO` → MCU가 `READY` 및 ACK로 응답; 연결 시 핸드셰이크로 사용.
*   `HB` → 하트비트; 수신 시 MCU는 lastHeartbeat를 업데이트하고 ACK.
*   `SAFE_CLEAR` → MCU의 EMERG 상태를 해제하고 `EMERG_CLEARED`를 방출.
*   `V,<idx>,O|C` → 인덱스로 서보 밸브 열기/닫기.

**원격 측정 (MCU에서):**

*   **시스템 라인 (CRC 프레임 아님)**: `READY`, `BOOT,*`, `PONG`, `EMERG`, `EMERG_CLEARED`, `ACK,*`, `NACK,*`.
*   **센서/밸브 라인은 `,XX` (CRC-8 16진수)로 끝나야 합니다.** 예:
    *   `pt1:850.5,pt2:900.0,V0_LS_OPEN:1,tc1:25.5,A9`
    *   **키:**
        *   압력: `pt1..pt4` (psi)
        *   유량: `fm1_Lh` `fm2_Lh`는 `flow1`/`flow2` (L/h)에 매핑됨
        *   열전대: `tc1` `tc2` (숫자 또는 오류 문자열)
        *   리미트 스위치: `V<idx>_LS_OPEN` / `V<idx>_LS_CLOSED` (0/1)

**CRC 세부 정보:**

*   CRC-8 다항식 0x07, 초기값 0x00, 반사 없음, xorout 0x00 (양쪽에서 조회 테이블 최적화).
*   GUI는 CRC가 없거나 일치하지 않는 원격 측정 데이터를 폐기하고 수신된 값과 계산된 값을 모두 보여주는 간결한 오류를 기록합니다.

## 5) 안전 메커니즘 및 타이밍 특성

**ARM 게이팅:**

*   시스템은 시작 후 및 직렬 연결 끊김 또는 EMERG 이벤트 후에 기본적으로 **DISARMED(준비 해제)** 상태입니다.
*   DISARMED 상태에서는 제어 명령 및 시퀀스가 메인 프로세스에 의해 차단됩니다.
*   운영자는 물리적 안전을 확인한 후 명시적으로 **ARM(준비)**해야 합니다 (아래 UI 워크플로우 참조).

**비상 처리:**

*   **자동**: GUI는 압력 한계와 변화율을 실시간으로 모니터링하고, 초과 시 메인 프로세스에 안전 이벤트를 보냅니다. 메인 프로세스는 소프트웨어 페일세이프를 시작합니다: 시퀀스 경로와 직접적인 폴백 원시 명령을 모두 사용하여 주 밸브를 닫고 벤트/퍼지를 엽니다.
*   **펌웨어 EMERG**: MCU는 자율적으로 `EMERG`를 트리거할 수 있습니다 (예: 하트비트 타임아웃 또는 트립). EMERG가 발생하면 GUI는 즉시 하트비트를 중지하고 큐를 비웁니다. `EMERG_CLEARED` 후 하트비트는 재개되지만 운영자가 다시 ARM할 때까지 시스템은 DISARMED 상태로 유지됩니다.
*   **수동 (운영자)**: 시퀀스 패널에서 ARMED 상태일 때 "Emergency Shutdown" 시퀀스를 실행할 수 있습니다. 물리적 E-stop은 항상 주요 비상 조치입니다.

**하트비트:**

*   **HeartbeatDaemon**: 연결 시 약 250ms마다 `HB`를 보냅니다. 빠른 MCU ARM을 위해 연결 시 즉시 `HB`를 한 번 보냅니다.
*   **SequenceEngine HB (시퀀스 중)**는 중복을 피하기 위해 우리 설정에서 비활성화되어 있습니다. 데몬이 표준 소스입니다.

**타이밍 기본값 (소프트웨어):**

*   SerialManager ACK 타임아웃: 1500ms, 5회 재시도 (NACK 재시도 지연 80ms).
*   SequenceEngine ACK 타임아웃: 1000ms (명령당).
*   피드백 타임아웃: 기본 5000ms (리미트 스위치 폴링 50ms).
*   압력 대기 디바운스: 3개의 연속 샘플이 임계값을 만족해야 합니다.
*   재연결: 300ms에서 시작하여 최대 5초까지 지수적 백오프.
*   핸드셰이크 타임아웃: 열기 대기 최대 5초; HELLO/READY 최대 3초.

## 6) 소프트웨어 설치 및 실행 (Windows)

**운영자 설치 (패키지):**

1.  패키지된 NSIS 설치 프로그램을 설치하거나 제공된 릴리스의 압축을 풉니다.
2.  아두이노 메가 드라이버가 사용 가능한지 확인합니다 (Windows가 자동으로 설치해야 함). 장치 관리자에서 COM 포트가 나타나는지 확인합니다.
3.  "GoRocket Control System GUI"를 실행합니다.
4.  업데이트가 필요한 경우 앱의 `resources/` 폴더 옆에 `config.json` 및 `sequences.json`을 배치합니다 (섹션 11 참조). 앱은 패키징될 때 이 리소스 경로에서 로드합니다.

**개발자 설치 (소스):**

1.  **요구 사항**: Node.js 20+, npm 10+, Python 3.x (네이티브 모듈에 필요한 경우), 빌드 도구.
2.  `npm install`
3.  **개발**: `npm run dev` (포트 9002에서 준비된 후 Next 개발 서버와 Electron을 생성)
4.  **앱 바이너리 빌드**: `npm run build && npm run package`
5.  **네이티브 모듈 문제 해결**: serialport 바이너리 불일치가 발생하면 `npm run rebuild`를 실행합니다.

## 7) 사용자 인터페이스 둘러보기 및 운영 워크플로우

**한눈에 보는 패널:**

*   **헤더**: 연결, 포트 선택, 새로고침, 연결/연결 해제, 로깅 제어, 압력 경보/트립 표시기, DISARMED/ARMED 상태 및 "Clear Emergency".
*   **센서 패널**: 원격 측정 데이터의 실시간 센서 값 (pt1–pt4, 유량, 온도).
*   **밸브 제어 및 상태**: 이름, 상태, 리미트 스위치 상태를 보여주는 7개의 밸브 타일과 열기/닫기 버튼.
*   **제어 시퀀스**: "Emergency Shutdown"을 포함하여 시퀀스 시작 (ARMED 필요). 취소 버튼은 현재 시퀀스를 중지합니다.
*   **차트 패널**: 경보/트립 라인이 있는 압력 및 기타 센서의 시계열 차트.
*   **터미널 패널**: 최근 시퀀스 로그 라인 및 메시지.

**운영 단계:**

1.  **하드웨어 전원 켜기**: 모든 하드웨어 및 안전 시스템이 준비되었는지 확인합니다.
2.  **GUI 실행**. 처음에는 시스템이 DISARMED 상태입니다.
3.  올바른 COM 포트를 선택하고 **Connect**를 클릭합니다. GUI는 HELLO/READY 핸드셰이크를 수행하고 하트비트(250ms)를 시작합니다.
4.  원격 측정 업데이트(압력, 유량, 온도, 밸브 리미트 스위치)를 확인합니다. 그렇지 않은 경우 배선 및 CRC 오류를 확인하십시오.
5.  **시스템 ARM(준비):**
    *   물리적 시험대가 안전한 구성인지 확인합니다.
    *   "ARM System"을 클릭하고 대화 상자에서 확인합니다. UI에 ARMED가 표시됩니다.
6.  **운영:**
    *   **수동 밸브**: 각 밸브 타일에서 열기/닫기를 사용합니다. 상태는 리미트 스위치에서 업데이트됩니다. 멈춘 경우 UI는 "STUCK" 플래그를 지정합니다.
    *   **시퀀스**: 미리 정의된 시퀀스를 시작합니다 (예: "Pre-Operation Safe Init", "Hot-Fire Sequence"). UI는 단계별 진행 상황을 기록합니다.
7.  **비상 대응:**
    *   **자동**: 압력 한계/비율 초과 시 GUI가 페일세이프를 트리거합니다. MCU는 펌웨어 트립 로직에 따라 자발적으로 EMERG에 들어갈 수 있습니다.
    *   **수동**: ARMED 상태에서 시퀀스 패널에서 "Emergency Shutdown"을 시작합니다. 항상 물리적 E-stop을 누를 준비를 하십시오.
8.  **MCU 비상 상태 해제**: MCU가 `EMERG` 상태인 경우 "Clear Emergency"를 약 3초 동안 누른 다음 확인합니다. GUI는 `SAFE_CLEAR`를 보내고 `EMERG_CLEARED`를 기다립니다.
9.  **DISARM 전환**: 모든 EMERG 또는 연결 끊김은 DISARM을 유발합니다. 제어 명령을 다시 실행하기 전에 재ARM이 필요합니다.
10. **로깅**: "Start Logging" / "Stop Logging"을 사용합니다. 로그는 Documents 아래에 기록됩니다. 섹션 8을 참조하십시오.

**확대/축소 및 접근성:**

*   Ctrl + 마우스 휠: 차트/UI 확대/축소; Ctrl + ‘=’/‘-’/‘0’도 작동합니다. 재설정 옵션을 사용할 수 있습니다.

## 8) 로깅, 파일 아티팩트 및 데이터 보존

로깅이 시작되면 GUI는 세션 폴더를 생성합니다:

*   **위치**: `Documents/rocket-logs/session-YYYYMMDD-HHMMSS/`
*   **파일:**
    *   `data.csv`: 센서 필드 및 요약된 밸브 상태(예: `V0:OPEN`)의 타임스탬프가 찍힌 CSV 라인.
    *   `config.json`, `sequences.json`: 추적성을 위한 스냅샷 (또는 누락된 경우 주석이 달린 플레이스홀더).
    *   `session-meta.json`: 앱 버전, 플랫폼, Electron/Node 버전, config/sequences의 SHA-256 및 사용 중인 안전 임계값.

**로그 형식:**

*   **일반 원격 측정 라인**: `ISO8601,<pt1>,<pt2>,<pt3>,<pt4>,<flow1>,<flow2>,<tc1>,<tc2>,<valves>`
*   **상태 이벤트 (`EMERG`, `FAILSAFE`, `READY`)**: 사후 분석을 위해 `#` 접두사 사용.
*   **ACK/NACK 라인**: 명확성을 위해 CSV에서 필터링됨.
*   **플러시 동작**: 로거는 약 2초마다, 그리고 앱 종료 또는 비상 전환 시 파일 디스크립터를 fsync합니다.

## 9) 설정: `config.json`

**위치:**

*   **개발**: 프로젝트 루트 (`config.json`).
*   **패키지**: 애플리케이션 `resources/` 디렉토리에서 로드됨.

**스키마 (필드):**

*   `serial.baudRate` (숫자): 예: 115200.
*   `maxChartDataPoints` (숫자): UI 차트에 유지할 포인트 수.
*   `pressureLimitPsi` (숫자): UI 사용을 위한 기본 한계.
*   `pressureLimitAlarmPsi` (숫자, 선택 사항): UI 경보 라인.
*   `pressureLimitTripPsi` (숫자, 선택 사항): UI 트립 라인.
*   `pressureRateLimitPsiPerSec` (숫자, 선택 사항): 변화율 한계.
*   `valveFeedbackTimeout` (ms): UI 'stuck' 감지 타임아웃.
*   `initialValves` (배열): 7개 밸브(ID 1-7)의 이름 및 초기 상태.
*   `valveMappings` (레코드): 사람이 읽을 수 있는 이름을 서보 인덱스(0-6)에 매핑합니다. 예:

```json
{
  "valveMappings": {
    "Ethanol Purge Line":   { "servoIndex": 0 },
    "Main Pressurization":  { "servoIndex": 1 },
    "Ethanol Fill Line":    { "servoIndex": 2 },
    "N2O Main Supply":      { "servoIndex": 3 },
    "Ethanol Main Supply":  { "servoIndex": 4 },
    "System Vent 1":        { "servoIndex": 5 },
    "System Vent 2":        { "servoIndex": 6 }
  }
}
```

**유효성 검사:**

*   GUI는 기본적인 온전성(예: 경보 < 트립)에 대해 압력 한계를 검증합니다. 필드가 누락되거나 의심스러운 경우 콘솔에 경고가 나타납니다.

## 10) 시퀀스: 개념, 작성, 검증 (`sequences.json`)

**개념:**

*   시퀀스는 순서가 있는 단계 목록입니다. 각 단계에는 사람이 읽을 수 있는 메시지, 명령을 수행하기 전의 `delay`(ms), 선택적 `condition` 대기 및 실행할 `commands` 목록이 있습니다.
*   두 가지 명령 형식이 지원됩니다:
    *   **인덱스별**: `"V,<idx>,O|C"` (예: `"V,4,O"`)
    *   **이름별**: `"CMD,<ValveName>,Open|Close"` (`config.json` valveMappings를 통해 매핑됨)

**조건:**

*   `pt1..pt4`에 대한 압력 조건, 연산자 `gte`/`lte`, 최소/최대 임계값 및 `timeoutMs`.
*   예: 120초 타임아웃으로 `pt1 >= 580 psi` 대기:

```json
{ "sensor": "pt1", "min": 580, "op": "gte", "timeoutMs": 120000 }
```

**유효성 검사 및 안전망:**

*   앱은 Ajv를 사용하여 `sequences.json`을 `sequences.schema.json`에 대해 유효성을 검사합니다.
*   정적 금지 및 드라이런 검사는 위험한 조합(예: 동일한 단계에서 주 공급 장치와 벤트를 동시에 여는 것)을 차단합니다. 유효한 `"Emergency Shutdown"` 시퀀스는 필수입니다.
*   시작 시 유효성 검사에 실패하면 앱은 오류를 표시하고 종료합니다(fail-fast).

**드라이런:**

*   앱은 각 비상 시퀀스가 아닌 시퀀스를 시뮬레이션하여 논리적 충돌(열림-열림 조합)을 감지합니다. 실패 시 시작이 중단됩니다.

**예제 스니펫 (발췌):**

```json
"Emergency Shutdown": [
  {
    "message": "즉시 안전 상태",
    "delay": 0,
    "commands": [
      "CMD,Ethanol Main Supply,Close",
      "CMD,N2O Main Supply,Close",
      "CMD,Main Pressurization,Close",
      "CMD,Ethanol Fill Line,Close",
      "CMD,System Vent 1,Open",
      "CMD,System Vent 2,Open",
      "CMD,Ethanol Purge Line,Open"
    ]
  }
]
```

## 11) 밸브 매핑 및 시퀀스를 안전하게 변경하는 방법

**밸브 매핑 (`config.json`):**

*   배선 변경(서보 인덱스 0-6)을 반영하도록 `valveMappings`를 편집합니다. `initialValves` 이름이 매핑 키와 일치하는지 확인하십시오.
*   편집 후 앱을 다시 시작하십시오. 패키지된 앱에서는 `resources/config.json`을 업데이트하고 다시 시작하십시오.

**시퀀스 (`sequences.json`):**

*   `CMD,<ValveName>,Open|Close` 또는 `V,<idx>,O|C`를 사용하여 단계를 편집합니다.
*   위험한 조합을 같은 단계에 두지 마십시오. 필요한 경우 지연이 있는 별도의 단계를 사용하십시오(예: 퍼지 후 벤트).
*   GUI를 시작하지 않고 로컬에서 유효성을 검사합니다:
    *   `npm run validate:seq`
    *   스크립트는 `AJV_OK true` 또는 자세한 오류를 출력합니다.
*   업데이트된 시퀀스를 로드하려면 앱을 다시 시작하십시오. 패키지된 앱에서는 `resources/sequences.json`을 교체하십시오 (스키마도 변경된 경우 `resources/sequences.schema.json`도 교체).

**권장 워크플로우:**

1.  먼저 `config.json` 매핑을 업데이트합니다.
2.  `sequences.json` 명령을 업데이트합니다 (가독성 및 매핑 안전을 위해 `CMD,<ValveName>,...` 선호).
3.  `npm run validate:seq`를 실행합니다.
4.  앱을 시작하고 시작 유효성 검사 오류를 수정합니다.
5.  핫파이어 작동 전에 HIL 테스트를 실행합니다.

## 12) 문제 해결 및 일반적인 문제

*   **COM 포트 없음 / 연결 실패:**
    *   장치 관리자 및 드라이버를 확인하십시오. 다른 USB 포트/케이블을 시도해 보십시오. GUI는 약 5초 후에 열기 시간이 초과되고 오류를 표시합니다.
*   **핸드셰이크가 READY가 아님:**
    *   GUI는 `HELLO`를 보내고 약 3초 이내에 `READY` 또는 `ACK`를 예상합니다. 그렇지 않은 경우 펌웨어가 플래시되고 실행 중인지, 전원이 안정적인지 확인하십시오.
*   **로그의 CRC 불일치 오류:**
    *   GUI는 잘못된 라인을 버리고 자세한 무결성 오류를 출력합니다. 펌웨어가 마지막 쉼표까지의 ASCII에 대해 CRC-8 다항식 0x07을 사용하여 `...,<CRC>`를 내보내는지 확인하십시오. 직렬 라인 노이즈를 피하고 접지/차폐를 확인하십시오.
*   **NACK BUSY / MCU Busy 토스트:**
    *   MCU는 서보가 움직이는 동안 명령을 거부합니다. 이동이 완료될 때까지 기다리십시오. GUI는 BUSY에 대해 방해가 되는 대화 상자를 피합니다.
*   **EMERG 폭풍 / 반복되는 EMERG 이벤트:**
    *   시스템은 큐를 중지하고 페일세이프 상태를 래치합니다. 근본 원인(압력 스파이크, 하트비트 문제)을 조사하십시오. 안전할 때 "Clear Emergency"를 길게 눌러 해제한 다음 다시 ARM하십시오.
*   **시퀀스 패널 비활성화됨 (DISARMED):**
    *   먼저 시스템을 ARM하십시오 (안전 요구 사항). DISARMED 상태에서도 압력 초과 시 자동 페일세이프는 계속 실행됩니다.
*   **로그가 없거나 생성할 수 없음:**
    *   GUI는 토스트를 통해 알립니다. Documents 권한 및 디스크 공간을 확인하십시오.

## 13) 빌드, 패키징 및 테스트 (유지보수 담당자용)

**스크립트:**

*   `npm run dev` → Next 개발 서버 (Turbopack) + Electron (`http://localhost:9002`를 기다림).
*   `npm run build:electron` → main/preload TS를 `dist/`로 컴파일하고 `config.json`을 복사합니다.
*   `npm run build:web` → Next 정적 내보내기를 `out/`으로 합니다.
*   `npm run build` → Electron + 웹 빌드.
*   `npm run package` → `config.json` / `sequences.json` / `sequences.schema.json`을 포함하는 `extraResources`가 있는 Electron Builder (AppImage/NSIS/DMG).
*   `npm run typecheck` / `npm run lint`
*   `npm test` → Jest 테스트 (CRC 구문 분석, 페일세이프 래칭, 수용 테스트와 유사한 경로).

**참고:**

*   Serialport 네이티브 모듈은 번들로 제공됩니다. `asarUnpack`이 이를 처리합니다. 로컬 개발에서 ABI 불일치가 표시되면 `npm run rebuild`를 실행하십시오.
*   CSP: 개발 중 앱은 HMR을 위해 `unsafe-eval`을 허용할 수 있습니다. HMR 웹 소켓이 실패하면 개발 빌드에서만 `connect-src`를 확장하여 `ws:`를 포함하십시오.

## 14) 참조 부록

**SequenceEngine 의미론:**

*   단계는 `cmd` 또는 `wait`일 수 있습니다.
*   `cmd`에는 선택적 피드백이 포함될 수 있습니다: 타임아웃 및 폴링 간격으로 리미트 스위치(열림/닫힘)를 기다립니다.
*   압력에 대한 `wait` 조건은 깜박임과 노이즈를 피하기 위해 디바운스된 평가(기본적으로 3회 연속 일치)를 사용합니다.

**페일세이프 패스 (소프트웨어):**

*   엔진은 여러 패스에서 주 밸브를 닫고 벤트 및 퍼지를 열며, 필요한 경우 즉시 원시 라인을 작성하고, 복구를 가속화하기 위해 짧은 ACK 타임아웃으로 프레임된 명령도 보냅니다.
*   밸브 역할(주/벤트/퍼지)은 시작 시 매핑에서 파생됩니다.

**원격 측정 구문 분석 (GUI):**

*   GUI는 시스템 메시지(READY/EMERG/ACK/NACK)를 무시하고 CRC 검사를 하지 않습니다.
*   CRC가 유효한 한 혼합 패킷(예: 센서 값 + 리미트 스위치)이 허용됩니다.

**로그 구조:**

*   `data.csv`의 `#` 접두사 라인은 상태 전환(`EMERG`, `FAILSAFE`, `READY`)을 표시합니다.
*   ACK/NACK 라인은 로그를 간결하고 분석하기 쉽게 유지하기 위해 의도적으로 필터링됩니다.

**런북 및 체크리스트:**

*   권장 절차 및 비행 전 결과는 리포지토리의 `RUNBOOK.md`, `DAY-OF-TEST-CHECKLIST.md` 및 `HIL-Preflight-Checklist-Results.md`를 참조하십시오. 항상 특정 테스트 항목 및 안전 정책에 맞게 조정하십시오.

---

이 매뉴얼은 현재 코드베이스의 동작을 반영합니다. 하드웨어 토폴로지나 위험 상태가 다른 경우 `config.json` 및 `sequences.json`을 적절하게 업데이트하고, 유효성을 검사하고(`npm run validate:seq`), HIL/저에너지 테스트로 리허설한 다음 핫파이어 작업으로 진행하십시오. 안전이 최우선입니다.

## 15) IPC 및 이벤트 참조

**렌더러 → 메인 (달리 명시되지 않는 한 ipcRenderer.invoke):**

*   `serial-list` → `Promise<string[]>`
    *   사용 가능한 직렬 포트 경로(예: `COM3`, `/dev/ttyUSB0`)를 반환합니다.
*   `serial-connect` `{ path: string, baud: number }` → `Promise<boolean>`
    *   포트에 연결하고, HELLO/READY 핸드셰이크를 수행하고, 하트비트를 시작합니다.
*   `serial-disconnect` → `Promise<boolean>`
    *   포트를 정상적으로 닫고 로깅을 중지합니다.
*   `serial-send` `SerialCommand | { raw: string } | string` → `Promise<boolean>`
    *   제어/RAW 명령을 보냅니다. DISARMED 상태이고 제어 명령인 경우 거부합니다. BUSY 오류는 대화 상자 대신 `serial-busy`를 내보냅니다.
*   `sequence-start` `(name: string)` → `Promise<boolean>`
    *   명명된 시퀀스를 시작합니다. ARMED가 필요합니다.
*   `sequence-cancel` → `Promise<boolean>`
    *   현재 시퀀스가 있는 경우 취소합니다.
*   `safety-trigger` `(snapshot?: { reason?: string })` → `Promise<boolean>`
    *   소프트웨어 페일세이프(주 밸브 닫기, 벤트/퍼지 열기)를 트리거하고 시퀀스 오류를 내보냅니다.
*   `safety:pressureExceeded` (ipcRenderer.send) `(snapshot: PressureSnapshot)`
    *   UI 압력 안전이 초과되었음을 메인에 알립니다. 메인은 폴백으로 페일세이프 경로를 실행합니다.
*   `config-get` → `Promise<AppConfig>`
*   `get-sequences` → `Promise<{ sequences: SequenceConfig; result: ValidationResult }>`
*   `safety-clear` → `Promise<boolean>`
    *   EMERG를 해제하기 위해 MCU에 `SAFE_CLEAR`를 보냅니다. `EMERG_CLEARED` 시스템 라인을 예상합니다.
*   `system-arm` → `Promise<boolean>`
    *   ARMED를 설정합니다 (제어 명령 활성화). UI에서 운영자 확인이 필요합니다.
*   `system-arm-status` → `Promise<boolean>`
    *   ARMED일 때 `true`를 반환합니다.
*   `zoom-in` / `zoom-out` / `zoom-reset` (ipcRenderer.send) → `void`
*   `start-logging` / `stop-logging` (ipcRenderer.send) → `void`

**메인 → 렌더러 (ipcMain에서 내보낸 이벤트):**

*   `serial-status` `(SerialStatus)`
    *   `state: 'connected' | 'disconnected' | 'reconnecting'`, `path?`.
*   `serial-data` `(string)`
    *   원시 원격 측정/시스템 라인. 렌더러는 원격 측정에 대한 CRC를 검증합니다.
*   `serial-error` `(string)`
*   `serial-busy` `({ command: any; error: string })`
    *   토스트를 위한 방해되지 않는 BUSY 알림.
*   `sequence-progress` `({ name, stepIndex, step, note? })`
*   `sequence-error` `({ name, stepIndex, step?, error })`
*   `sequence-complete` `({ name })`
*   `log-creation-failed` `(string | undefined)`

**프리로드 API (window.electronAPI):**

*   메서드는 위의 호출을 미러링하고 구독 헬퍼를 제공합니다: `onSerialStatus`, `onSerialData`, `onSerialError`, `onSerialBusy`, `onSequenceProgress`, `onSequenceError`, `onSequenceComplete`, `onLogCreationFailed`.

## 16) 코드 경로 둘러보기

**연결 및 핸드셰이크:**

1.  렌더러가 `listSerialPorts()` 및 `connectSerial(path, baud)`를 호출합니다.
2.  메인 `SerialManager.connect()`:
    *   포트를 열고 `ReadlineParser`(개행으로 구분)를 파이프합니다.
    *   `close`, `error`, `data`를 구독합니다.
    *   `sendHelloHandshake()`를 수행합니다 → `HELLO`를 프레임합니다 → 약 3초 이내에 `READY` 또는 ACK를 예상합니다.
    *   `serial-status: connected`를 내보내고, `HeartbeatDaemon`(250ms)을 시작하고 즉시 `HB`를 보냅니다.
    *   성공적으로 연결되면 로깅을 시작합니다.

**명령 보내기 (수동 밸브 또는 시퀀스 단계):**

1.  렌더러가 `sendToSerial(cmd)`를 호출합니다.
2.  메인은 제어 명령에 대해 ARM을 검증합니다. DISARMED이면 거부합니다.
3.  `SerialManager.send()`:
    *   `SerialCommand` 또는 `raw`/string에서 페이로드를 빌드합니다.
    *   필요한 경우 `payload,msgId,crc`를 프레임합니다.
    *   진행 중으로 큐에 넣고, 라인을 쓰고, ACK 타임아웃(기본 1500ms, 5회 재시도)을 시작합니다.
    *   `ACK,<id>` 시: 해결하고 다음을 처리합니다. `NACK,<id>,BUSY` 시: 다시 큐에 넣거나 UI에 `serial-busy`를 내보냅니다.

**원격 측정 흐름:**

1.  MCU가 라인을 내보냅니다. 시스템 라인(`READY`, `EMERG`, `ACK`, `NACK`, …)은 통과됩니다.
2.  센서 라인은 `,XX` CRC로 끝납니다. 렌더러는 `parseSensorData()`를 통해 구문 분석합니다:
    *   CRC-8(0x07)을 확인합니다. 불일치 시 버리고 무결성 오류를 기록합니다.
    *   `pt1..pt4`, `fm*_Lh` → `flow*`, `tc*`(숫자 또는 오류 문자열) 및 밸브 리미트 스위치 상태를 추출합니다.
3.  UI는 센서 상태, 차트 및 밸브별 LS 표시기를 업데이트합니다. 압력 안전 모니터는 메인에 `safety:pressureExceeded`를 내보낼 수 있습니다.

**비상 경로:**

*   **펌웨어 기반**: MCU가 `EMERG`를 보냅니다 → 메인은 하트비트를 중지하고, 큐를 비우고, 진행 중/대기 중인 작업을 중단합니다. UI는 제어를 잠급니다. DISARM이 강제됩니다. `EMERG_CLEARED` 시 하트비트가 재개됩니다. 운영자는 다시 ARM해야 합니다.
*   **UI 기반**: 렌더러가 `safety-trigger` 또는 `safety:pressureExceeded`를 보냅니다 → 메인은 `SequenceEngine.tryFailSafe()`를 실행하고 매핑된 원시 밸브 OPEN/CLOSE 폴백(벤트/퍼지 열기, 주 밸브 닫기)도 실행합니다. 이유를 설명하는 `sequence-error`를 내보냅니다.

**시퀀스 실행:**

1.  렌더러 `sequenceStart(name)` → 메인은 ARMED를 확인합니다 → `SequenceEngine.start(name)`.
2.  엔진 `toSteps()`는 단계를 정규화합니다: JSON에서 `cmd`와 `wait`를 인터리브합니다 (`CMD,<ValveName>,Open|Close` → 매핑을 통해 `V,<idx>,O/C`).
3.  `cmd`의 경우:
    *   ACK 타임아웃(기본 1000ms)으로 프레임된 페이로드를 보냅니다.
    *   선택적 피드백: 목표 상태 또는 타임아웃까지 LS 상태를 폴링합니다.
4.  `wait`(압력)의 경우: `timeoutMs`까지 디바운스된 조건(N회 연속 일치)을 평가합니다.
5.  단계별로 `sequence-progress`를 내보냅니다. 끝에서 `sequence-complete`를 내보냅니다. 오류 시 `sequence-error`를 내보내고 선택적으로 페일세이프를 트리거합니다.

## 17) 상태 머신

**SerialManager (큐/ACK):**

*   **상태**: `idle` → `writing` → `awaiting-ack` → `ack` (성공) → `idle`.
*   **타임아웃**: ACK 타임아웃 또는 `NACK` 시, 재시도 횟수까지 지연(80ms)하여 다시 큐에 넣습니다. 쓰기 오류/포트 닫힘 시 오류를 내보내고 재연결을 예약합니다(최대 5초까지 지수적 백오프).
*   **우선순위**: EMERG/FAILSAFE/HB/SAFE_CLEAR는 큐 관리에서 우선순위로 처리됩니다.

**SequenceEngine:**

*   **실행 플래그**: `running`, `cancelled`, `currentIndex` 추적.
*   **단계**: `cmd` (전송 + 선택적 LS 피드백), `wait` (시간 또는 디바운스가 있는 압력).
*   **페일세이프**: `inFailsafe` 래치는 400ms 이내에 재진입을 방지합니다. `emergencyActive` 동안 래치된 상태로 유지됩니다.
*   **하트비트**: 엔진 HB는 기본적으로 비활성화되어 있습니다 (데몬이 HB 제공). 정리는 HB를 중지하고 대기 중인 작업을 지웁니다.

**ARM 게이팅:**

*   `requiresArm` (시작 시, 연결 끊김, EMERG 시 true). true일 때 제어 명령 및 시퀀스가 차단됩니다.
*   렌더러는 DISARMED 배너를 표시합니다. 운영자는 제어를 활성화하려면 `systemArm()`을 호출해야 합니다.
