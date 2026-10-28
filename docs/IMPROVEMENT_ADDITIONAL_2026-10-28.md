# 추가 개선 계획 (2026-10-28) - 1~6번

프로젝트 분석을 바탕으로 추가 개선사항을 1~6번 순서로 정리합니다.

## 순서

1. **남은 any 타입 제거**
   - 목표: 타입 안정성 향상
   - 대상: `src/lib/share.ts`, `src/lib/templates.ts`, `src/hooks/useProjectGeneration.ts` 등
   - 구체적 타입 정의 추가

2. **복잡한 컴포넌트 추가 분할 - StoryboardList, SettingsPanel**
   - 목표: 가독성과 유지보수성 개선
   - 대상: `StoryboardList.tsx` (956줄), `SettingsPanel.tsx` (805줄)
   - 하위 컴포넌트로 추가 분할

3. **메모리 누수 점검 및 개선**
   - 목표: 메모리 사용량 최적화
   - 대상: blob URL 관리, 이벤트 리스너 정리, 타이머 정리
   - 파일: `src/lib/blobUrls.ts`, 컴포넌트들

4. **WebWorker 확대 활용**
   - 목표: UI 블로킹 최소화
   - 대상: 이미지 처리, 오디오 분석 등 무거운 연산
   - 파일: `src/workers/` (신규), 관련 lib 파일

5. **모바일 UX 개선**
   - 목표: 모바일 사용성 향상
   - 대상: 터치 인터페이스, 반응형 레이아웃 개선
   - 파일: `src/styles/responsive.css`, 컴포넌트들

6. **테스트 커버리지 확대**
   - 목표: 안정성 향상
   - 대상: 컴포넌트 테스트, 훅 테스트 추가
   - 파일: `tests/`

## 실행 원칙
- 각 항목 완료 후 테스트(`npm run test:run`) 실행
- 빌드 확인(`npm run build`)
- 린트 확인(`npm run lint`)
- 기능 변경 시 기존 동작 유지

## 진행 상황

- [x] 1. 남은 any 타입 제거 - share.ts, templates.ts 타입 개선
- [x] 2. 복잡한 컴포넌트 추가 분할 - storyboard/settings 폴더 생성
- [x] 3. 메모리 누수 점검 및 개선 - blob URL 정리 강화 (TTL, 만료 정리)
- [x] 4. WebWorker 확대 활용 - imageProcess.worker.ts, audioProcess.worker.ts 추가
- [x] 5. 모바일 UX 개선 - 반응형 스타일 추가
- [x] 6. 테스트 커버리지 확대 - common.test.ts 추가
