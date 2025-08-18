# 🚀 Gorocket Day-of-Test Checklist (1-Page)

**운용 버전**: `v2.6.0-safety-ready` **커밋**: `2f89eb6` **Config**: `08e9fdf`

## Pre-Test Setup (15분)

### 소프트웨어 검증
- [ ] 태그 확인: `git describe --tags` → `v2.6.0-safety-ready`
- [ ] 빌드 상태: Build ✅ Lint ✅ TypeScript ✅
- [ ] Config 잠금: 읽기 전용 확인, 변경 금지

### 하드웨어 연결
- [ ] Arduino Mega 2560 USB 연결 (115200 baud)
- [ ] 압력 센서 pt1-pt4 연결 확인
- [ ] 서보 V0-V6 연결 및 초기 위치 확인
- [ ] 리미트 스위치 전체 테스트

### UI 상태 확인
- [ ] 연결 후 DISARMED 배지 **표시되지 않음** (정상 ARM 상태)
- [ ] 텔레메트리: `pt1:XXX.XX,pt2:XXX.XX,pt3:XXX.XX,pt4:XXX.XX` 수신
- [ ] 온도: tc1/tc2 °C 단위로 표시 (29315 → 20.0°C)
- [ ] 하트비트: `writeNow('HB')` 정상 송신 (250ms 간격)

## 의도적 Fault 주입 (15분 soak)

### F1) HB 중단 테스트
- [ ] HeartbeatDaemon 중지 → 3초 후 `EMERG,HB_TIMEOUT`
- [ ] **DISARMED 배지 표시** + 제어 명령 차단 확인
- [ ] `SAFE_CLEAR` → 시스템 재-ARM → 정상 제어 복구

### F2) 재연결 테스트  
- [ ] 명령 큐 적재 → USB 연결 끊기 → 재연결
- [ ] **DISARMED 배지 표시** + `queue cleared` 로그
- [ ] 재-ARM 없이는 모든 제어 명령 거절 확인

### F3) NACK 폭주 테스트
- [ ] 펌웨어 모킹: 모든 명령 NACK 응답
- [ ] 재시도 5회 → 페일세이프 트리거
- [ ] 벤트/퍼지 자동 개방 + UI 에러 표시

## Cold-flow 진행 체크

### 시퀀스 검증
- [ ] **금지조합 차단**: System Vent 2 + Ethanol Main Supply 동시 오픈 시도 → 스키마 에러
- [ ] **금지조합 차단**: System Vent 2 + N2O Main Supply 동시 오픈 시도 → 스키마 에러
- [ ] 압력 wait 조건: 3샘플 연속 만족 후 진행 (디바운스)

### 데이터 수집
- [ ] 세션 폴더 생성: `Documents/rocket-logs/session-YYYYMMDD-HHMMSS/`
- [ ] 메타 파일: config/sequences/session-meta.json with 커밋·config 해시
- [ ] CSV 로그: `timestamp,pt1,pt2,pt3,pt4,flow1,flow2,tc1,tc2,valves`
- [ ] 실시간 플러시: 2초 간격 (hot-fire 시 100ms로 단축)

### 안전 모니터링
- [ ] 압력 임계: pt1-pt4 < 850 psi (alarm), < 1000 psi (trip)
- [ ] 압력 상승률: < 50 psi/s
- [ ] EMERG 신호 시 즉시 메인 닫기 + 벤트/퍼지 열기
- [ ] 우선순위 명령 (HB/EMERG) 지연 < 50ms

## Hot-fire 추가 게이트 (별도 시행)

- [ ] **G1** 지연 측정: EMERG → 밸브 동작 < 500ms (20% 여유)
- [ ] **G2** 전원 플랩: USB/전원 플래핑 후 DISARM 상태 유지
- [ ] **G3** 금지조합: UI 버튼 + 시퀀스 양쪽 모두 차단
- [ ] **G4** 데이터 보존: 해시 저장 + 로그 회수 리허설  
- [ ] **G5** 독립 검토: 안전 담당자 서명
- [ ] **G6** 런북 드라이런: 역할·콜사인·어보트 권한 리허설

## 비상 절차

**즉시 어보트**: UI `safety-trigger` 버튼 OR 물리적 전원 차단  
**복구**: `SAFE_CLEAR` → 시스템 재-ARM → 상황 평가 후 재개 여부 결정

**역할 배정**:
- 주 오퍼레이터: [콜사인] ________
- 안전 담당: [콜사인] ________  
- 어보트 권한: [콜사인] ________

**서명**: 
- 테스트 리드: ________ 날짜: ________
- 안전 담당: ________ 날짜: ________

---
**버전**: v2.6.0-safety-ready | **커밋**: 2f89eb6 | **Config**: 08e9fdf