# 🚀 로켓 지상 시험 제어 시스템

## 📋 현장 작업 절차

### **1단계: 현장 도착 후 기본 준비**

#### 하드웨어 연결 상세 점검
**전원 시스템**:
- [ ] 주 전원 (24V) 연결 및 전압 확인
- [ ] 아두이노 메가 전원 LED 점등 확인
- [ ] 서보모터 전원 분배기 상태 확인
- [ ] 센서 전원 공급 상태 확인 (5V, 3.3V)

**통신 연결**:
- [ ] 아두이노 메가 ↔ PC USB 케이블 연결
- [ ] 장치 관리자에서 COM 포트 인식 확인 (보통 COM3~COM8)
- [ ] USB 케이블 품질 확인 (데이터 라인 포함)

**밸브 액추에이터 (7개)**:
- [ ] Valve 0 (Ethanol Main): 서보 연결 및 리미트 스위치 2개
- [ ] Valve 1 (N2O Main): 서보 연결 및 리미트 스위치 2개
- [ ] Valve 2 (Ethanol Purge): 서보 연결 및 리미트 스위치 2개
- [ ] Valve 3 (N2O Purge): 서보 연결 및 리미트 스위치 2개
- [ ] Valve 4 (Pressurant Fill): 서보 연결 및 리미트 스위치 2개
- [ ] Valve 5 (System Vent): 서보 연결 및 리미트 스위치 2개
- [ ] Valve 6 (Igniter Fuel): 서보 연결 및 리미트 스위치 2개

**센서 연결**:
- [ ] 압력 센서 4개 (PT1~PT4): 아날로그 핀 A0~A3
- [ ] 온도 센서 2개 (TC1, TC2): MAX6675 모듈, SPI 통신
- [ ] 유량 센서 2개 (Flow1, Flow2): 디지털 핀 2, 3 (인터럽트)

#### 소프트웨어 시작 및 초기 설정
```bash
# 1. 터미널에서 프로젝트 디렉토리 이동
cd Gorocket-Control-System-GUI

# 2. 종속성 설치 (최초 1회)
npm install

# 3. 프로그램 실행
npm run dev

# 4. 브라우저에서 자동 실행 (보통 http://localhost:3000)
```

**GUI 부팅 과정 확인**:
- [ ] Electron 앱 창 열림 확인
- [ ] "Awaiting sequence data..." 메시지 표시
- [ ] 시리얼 포트 목록 로드 확인
- [ ] 센서 패널 "No Data" 상태 확인

### **2단계: 시스템 연결 및 초기화**

#### GUI 시리얼 연결 과정
**포트 선택 및 연결**:
1. **포트 새로고침**: 헤더 우측 "🔄" 버튼 클릭
2. **포트 확인**: 드롭다운에서 아두이노 COM 포트 확인
   - Windows: `COM3`, `COM4`, `COM5` 등
   - 포트가 없으면 USB 케이블 및 드라이버 확인
3. **포트 선택**: 올바른 COM 포트 선택
4. **연결 시도**: "Connect" 버튼 클릭
5. **연결 과정 모니터링**:
   - 상태: "Disconnected" → "Connecting" → "Connected"
   - 터미널 패널에서 연결 로그 확인

**연결 성공 시 확인사항**:
- [ ] 헤더 연결 상태: 🟢 "Connected" 표시
- [ ] 터미널: "Successfully connected to COM포트" 메시지
- [ ] 센서 데이터 실시간 수신 시작 (0.1초마다)
- [ ] Toast 알림: "Connected to COM포트" 표시

**연결 실패 시 대처**:
- [ ] 오류 메시지 확인 (Toast 및 터미널)
- [ ] USB 케이블 재연결
- [ ] 다른 COM 포트 시도
- [ ] 아두이노 리셋 버튼 누르기
- [ ] 장치 관리자에서 포트 상태 확인

#### 시스템 초기 상태 상세 점검
**밸브 상태 확인 (Valve Control & Status 패널)**:
- [ ] 모든 밸브 초기 상태: "CLOSED" (빨간색)
- [ ] 리미트 스위치 상태: 각 밸브마다 OPEN/CLOSED 스위치 표시
- [ ] 밸브별 상세 확인:
  ```
  Ethanol Main    [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  N2O Main        [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  Ethanol Purge   [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  N2O Purge       [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  Pressurant Fill [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  System Vent     [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  Igniter Fuel    [CLOSED] [LS_OPEN: ❌] [LS_CLOSED: ✅]
  ```

**센서 데이터 수신 확인 (Sensor Panel)**:
- [ ] 압력 센서 4개 실시간 값 표시:
  - PT1: XXX.XX PSI (정상 범위: 0~850)
  - PT2: XXX.XX PSI
  - PT3: XXX.XX PSI  
  - PT4: XXX.XX PSI
- [ ] 온도 센서 2개 실시간 값 표시:
  - TC1: XXX.XX K (일반적으로 293~323K, 20~50°C)
  - TC2: XXX.XX K
- [ ] 유량 센서 2개 실시간 값 표시:
  - Flow1: XXX.X L/h (정지 상태에서 0에 가까움)
  - Flow2: XXX.X L/h

**데이터 수신 품질 확인**:
- [ ] 센서 값이 0.1초마다 업데이트되는지 확인
- [ ] "ERR" 값이 표시되는 센서가 있는지 확인
- [ ] 비정상적으로 높거나 낮은 값이 있는지 확인
- [ ] 차트에서 안정적인 신호인지 확인 (큰 노이즈 없음)

### **3단계: 시험 준비 및 안전 확인**

#### 압력 시스템 상세 점검
**압력 한계 설정 확인**:
- [ ] **config.json** 파일에서 `"pressureLimit": 850` 확인
- [ ] 현재 모든 압력 센서 값이 한계값 이하인지 확인
- [ ] 압력 센서별 정상 범위 확인:
  - PT1 (주 탱크): 0~100 PSI (정상 대기압 근처)
  - PT2 (N2O 라인): 0~200 PSI
  - PT3 (에탄올 라인): 0~150 PSI
  - PT4 (가압 라인): 0~300 PSI

**응급 셧다운 시스템 테스트**:
1. **수동 응급 셧다운 테스트**:
   - [ ] "Emergency Shutdown" 버튼 클릭
   - [ ] 터미널에서 "🚨 EMERGENCY SHUTDOWN INITIATED" 확인
   - [ ] 모든 주 밸브가 즉시 닫히는지 확인 (100ms 이내)
   - [ ] System Vent가 열리는지 확인 (200ms 후)
   - [ ] 완료 메시지 "🛡️ Emergency shutdown completed" 확인

2. **자동 응급 셧다운 조건 확인**:
   - [ ] 압력 한계 초과 시 자동 트리거 (3회 연속 초과)
   - [ ] 통신 오류 시 자동 트리거
   - [ ] 센서 조건 실패 시 자동 트리거

#### 밸브 개별 동작 상세 테스트
**각 밸브별 동작 확인 절차**:

**1. Ethanol Main (ID: 0)**:
- [ ] 밸브 카드에서 "OPEN" 버튼 클릭
- [ ] 동작 과정 관찰:
  ```
  1. 서보 초기 각도로 이동 (7도)
  2. 리미트 스위치 확인 (LS_OPEN)
  3. 미감지 시 1도씩 감소 (6, 5, 4...)
  4. LS_OPEN 감지 시 반대로 3도 회전 (감지각도+3)
  5. 200ms 후 서보 전원 차단
  6. 상태 변경: CLOSED → OPEN (녹색)
  ```
- [ ] "CLOSE" 버튼으로 역동작 확인
- [ ] 터미널에서 동작 로그 확인

**2. N2O Main (ID: 1)**:
- [ ] 동일한 과정으로 OPEN/CLOSE 테스트
- [ ] 초기 각도: OPEN=25도, CLOSE=121도
- [ ] 리미트 스위치 동작 확인

**3~6. 나머지 밸브들**: 동일한 절차로 테스트
- [ ] Ethanol Purge (ID: 2): OPEN=12도, CLOSE=105도
- [ ] N2O Purge (ID: 3): OPEN=13도, CLOSE=117도
- [ ] Pressurant Fill (ID: 4): OPEN=27도, CLOSE=129도
- [ ] System Vent (ID: 5): OPEN=39도, CLOSE=135도
- [ ] Igniter Fuel (ID: 6): OPEN=45도, CLOSE=135도

**밸브 동작 상세 원리**:
```
[단계 1] 명령 수신
├─ GUI에서 OPEN/CLOSE 버튼 클릭
├─ 시리얼 명령 전송: "V,인덱스,O" 또는 "V,인덱스,C"
└─ 아두이노에서 명령 파싱

[단계 2] 서보 활성화
├─ 서보모터 전원 공급 (attach)
├─ 목표 각도로 즉시 이동
└─ 상태: IDLE → MOVING

[단계 3] 정밀 위치 조정
├─ 500ms 대기 (SERVO_SETTLE_TIME)
├─ 리미트 스위치 상태 확인
└─ 미감지 시 INCHING 모드 진입

[단계 4] 점진적 이동 (INCHING)
├─ 50ms마다 1도씩 이동
├─ OPEN: 각도 감소 (더 열림)
├─ CLOSE: 각도 증가 (더 닫힘)
└─ 리미트 스위치 감지까지 반복

[단계 5] 스톨 방지 릴리프
├─ 리미트 스위치 감지 즉시
├─ 반대방향으로 3도 회전
└─ 상태: INCHING → STALL_RELIEF

[단계 6] 완료 및 전원 차단
├─ 200ms 대기 (STALL_RELIEF_TIME)
├─ 서보 전원 차단 (detach)
└─ 상태: STALL_RELIEF → IDLE
```

**동작 실패 시 확인사항**:
- [ ] 서보모터 전원 공급 상태
- [ ] 리미트 스위치 배선 상태
- [ ] 기계적 간섭이나 막힘 여부
- [ ] 터미널에서 "VERR" 오류 메시지 확인

### **4단계: 시퀀스 실행**

#### 시퀀스 선택 및 실행 준비
**Sequence Panel 확인**:
- [ ] "6 sequences loaded successfully" 메시지 확인
- [ ] 사용 가능한 시퀀스 목록:
  ```
  ✅ Random Test A        (9단계, 기본 밸브 테스트)
  ✅ Random Test B        (9단계, 혼합 동작 테스트)
  ✅ Random Test C        (10단계, 복합 동작 테스트)
  ✅ Multi-Open Test      (7단계, 동시 제어 테스트)
  ✅ Sequential Mix       (9단계, 순차 동작 테스트)
  ✅ Chaos Test          (8단계, 복잡한 시나리오)
  🚨 Emergency Shutdown   (5단계, 응급 안전 절차)
  ```

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
