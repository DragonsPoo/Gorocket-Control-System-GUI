# Gorocket Control System GUI

<img width="2879" height="1700" alt="스크린샷 2025-08-18 151005" src="https://github.com/user-attachments/assets/564ed12d-4f81-4e95-be2c-24de8834fd96" />

## Changelog

### 2025-08-23
- **Fix: 유량 센서(Flow Sensor) 인식 오류 해결**
  - **문제점:** NPN 타입 유량 센서의 데이터가 GUI에 표시되지 않는 문제 발생.
  - **분석:** 테스트용 단순 펌웨어에서는 정상 동작했으나, 서보 및 다른 센서들과 함께 동작하는 메인 펌웨어에서 인터럽트가 제대로 처리되지 않음. 원인은 하드웨어 타이머(Timer3)와 다른 기능 간의 충돌로 추정.
  - **해결:** 메인 펌웨어(`arduino_mega_code.ino`)의 유량 센서 인터럽트 처리 방식을 하드웨어 타이머 대신 `micros()` 함수를 사용하도록 수정. 이는 정상 동작이 확인된 테스트용 펌웨어의 방식과 동일하며, 타이머 충돌 가능성을 원천적으로 제거함.