# 🚀 Gorocket HIL/Cold-flow 운용 Runbook

## 운용 재현성 정보
```
운용 커밋: 2f89eb6ec95c13e93bb31dc7657c5081c78f6bd5
태그: v2.6.0-safety-ready  
Config 해시: 08e9fdfeed1b95ffb0d1d41c2a0859f5538f915d765d9c9b4005815117eeca93
빌드 상태: ✅ Build OK, Lint OK, TypeScript OK
```

## 최종 안전 상태 확인

### 필수 패치 적용 상태 ✅
- [x] A1) 압력 텔레메트리 pt1..pt4 (arduino:572)
- [x] A2) CRC 분기 단일화 (parser:69) 
- [x] A3) EMERG 큐 페일세이프 + 재-ARM 게이트
- [x] A4) HB 단일화 + 비차단 송신

### 중요 개선 적용 상태 ✅
- [x] B1) 스키마 금지조합 대칭성 (System Vent 2)
- [x] B2) 세션 메타 config 소스 정합
- [x] B3) 로깅 타이밍 (연결 후 시작/실패 즉시 중단)
- [x] B4) 온도 단위 정합 (UI에서 K→°C 변환)
- [x] B5) 압력 wait 디바운스 (3샘플)
- [x] B6) 우선순위/큐 상한 (MAX_QUEUE_LEN=200)

## 의도적 Fault 주입 3종 (15분 soak)

### F1) HB 중단→펌웨어 비상 확인
```
1. 연결 수립 후 HeartbeatDaemon 강제 중지
2. 펌웨어 HEARTBEAT_TIMEOUT_MS(3000ms) 후 EMERG 확인
3. SAFE_CLEAR + 시스템 재-ARM 수행
4. 로그: [EMERG,HB_TIMEOUT] → [BLOCK,disarmed] → [ARM,ready]
```

### F2) 시리얼 재연결→묵은 명령 0
```  
1. 명령 큐에 일반 명령들 적재
2. 시리얼 포트 강제 끊기
3. 재연결 시 큐 비움 + requiresArm=true 확인
4. 로그: queue cleared(N→0), requires re-ARM
```

### F3) NACK 폭주→재시도→페일세이프
```
1. 펌웨어 모킹: 모든 명령에 NACK 응답
2. 재시도 5회 → 페일세이프 트리거 확인
3. UI 에러 표면화 + 벤트/퍼지 자동 개방
4. 로그: NACK retry(5) → failsafe triggered
```

## Hot-fire 추가 게이트 6종

### G1) 지연 측정 실기
- EMERG 신호 → 메인 닫힘·벤트/퍼지 개방 end-to-end 지연
- 목표: <500ms, 여유 20% 이상 확보
- 로그: 타임스탬프 정밀 측정

### G2) 전원/USB 플랩 내성
- 전원 순간 강하, USB 연결 플래핑  
- requiresArm=true 상태 유지 확인
- 복구 후 재-ARM 없인 명령 차단 지속

### G3) 금지조합 실기 검증
- System Vent 2 + Ethanol/N2O Main Supply 동시 오픈 시도
- UI 버튼/시퀀스 양쪽에서 차단 확인
- 스키마 검증 에러 메시지 표시

### G4) 데이터 보존 확인
- 세션 디렉터리 생성: config/sequences/meta 파일
- 커밋·config·sequences 해시 저장 검증
- 로그 회수 절차 1회 리허설

### G5) 독립 검토 서명
- 안전 담당자(제3자) 코드 리뷰
- 절차·체크리스트 검증 서명
- 운용 승인 문서 준비

### G6) 런북 드라이런  
- 역할 배정: 오퍼레이터/안전 담당/어보트 권한
- 콜사인/절차 1회 이상 리허설
- 비상 상황 시나리오 포함

## 운용 중 주의사항

### DISARM 상태 모니터링
- requiresArm=true 시 UI 상단 DISARMED 배지 표시
- EMERG/재연결 후 수동 재-ARM 필수
- 제어 명령 차단 시 명확한 에러 메시지

### 단위·표기 확인
- tc1/tc2: K×100 → °C 변환 ((29315→20.0°C))
- 압력: PSI×100 → PSI (pt1:15000→150.00 psi)
- 모든 그래프·토스트에 단위 라벨 표시

### 우선순위 경로 헬스체크
- HB/EMERG writeNow() 즉시 송신 확인
- 부하 상태에서도 우선순위 명령 지연 없음
- 타임스탬프 로그로 성능 검증

## 비상 연락처 & 어보트 절차
```
주 오퍼레이터: [콜사인]
안전 담당: [콜사인] 
어보트 권한: [콜사인]
즉시 어보트: UI safety-trigger 버튼 OR 물리적 파워 차단
```

---
**문서 생성**: 2025-01-18 Claude Code  
**적용 버전**: v2.6.0-safety-ready (2f89eb6)  
**다음 검토**: Hot-fire 전 G1-G6 게이트 통과 후