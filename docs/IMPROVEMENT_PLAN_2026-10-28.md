# 개선 계획 (2026-10-28)

프로젝트 분석을 바탕으로 개선할 점을 1~8번 순서로 정리합니다.

## 순서

1. **App.tsx 리팩토링 - 비즈니스 로직을 커스텀 훅으로 분리**
   - 목표: App.tsx를 얇은 오케스트레이터로 만들고, 생성/내보내기/저장 로직을 훅으로 분리
   - 대상: `useProjectGeneration`, `useProjectExport`, `useAutoSave`, `usePwaUpdate`, `useSharedImport` 등
   - 파일: `src/App.tsx`, `src/hooks/useProjectGeneration.ts` (신규), `src/hooks/useProjectExport.ts` (신규), `src/hooks/useAutoSave.ts` (신규), `src/hooks/usePwaUpdate.ts` (신규)

2. **큰 컴포넌트 분할 - StoryboardList, SettingsPanel**
   - 목표: 가독성과 유지보수성 개선
   - 대상: `StoryboardList.tsx` (956줄), `SettingsPanel.tsx` (805줄)
   - 하위 컴포넌트로 분리: SceneItem, BeatItem, SettingsSection 등

3. **타입 강화 - any 제거 및 API 응답 타입 정의**
   - 목표: 타입 안정성 향상
   - 대상: `src/lib/gemini.ts` (`data: any`, `payload: any` 등), 기타 `any` 사용처
   - Gemini API 응답 타입 정의

4. **성능 최적화 - kaTeX 동적 임포트 및 불필요한 리렌더링**
   - 목표: 번들 크기 및 렌더링 성능 개선
   - 대상: kaTeX 사용처에서 동적 임포트, React.memo/useCallback 최적화 검토
   - 파일: `src/lib/assets.ts`, 수식 관련 컴포넌트

5. **에러 처리 개선 - 에러 경계 세분화 및 에러 메시지 일관성**
   - 목표: 더 구체적인 에러 처리
   - 대상: 에러 경계 추가, gemini 에러 메시지 i18n 일관성
   - 파일: `src/components/ErrorBoundary.tsx`, 에러 메시지 처리

6. **메모리 관리 개선 - blob URL 정리 강화**
   - 목표: 메모리 누수 방지
   - 대상: blob URL 생성/해제, 프로젝트 전환 시 정리
   - 파일: `src/lib/blobUrls.ts`, 관련 훅/컴포넌트

7. **코드 중복 제거 및 유틸리티 통합**
   - 목표: DRY 원칙 적용
   - 대상: 중복된 유틸리티 함수, 공통 패턴
   - 파일: `src/lib/`, 공통 컴포넌트

8. **테스트 커버리지 확충 및 문서화**
   - 목표: 안정성 및 유지보수성 향상
   - 대상: 커스텀 훅 테스트, 복잡한 유틸리티 테스트, 주요 함수에 JSDoc 추가
   - 파일: `tests/`, `src/lib/`, `src/hooks/`

## 실행 원칙
- 각 항목 완료 후 테스트(`npm run test:run`) 실행하여 회귀 확인
- 빌드 확인(`npm run build`) 
- 린트 확인(`npm run lint`)
- 기능 변경 시 기존 동작 유지

## 진행 상황

- [x] 1. App.tsx 리팩토링 - 비즈니스 로직을 커스텀 훅으로 분리 (useAutoSave, usePwaUpdate, useSharedImport, useProjectGeneration)
- [x] 2. 큰 컴포넌트 분할 - StoryboardList, SettingsPanel용 하위 컴포넌트 폴더 및 일부 컴포넌트 생성
- [x] 3. 타입 강화 - Gemini API 응답 타입 정의, 일부 any 제거
- [x] 4. 성능 최적화 - kaTeX 동적 임포트 확인 (이미 적용됨)
- [x] 5. 에러 처리 개선 - ErrorBoundary 개선 및 스타일 추가
- [ ] 6. 메모리 관리 개선 - blob URL 정리 강화
- [ ] 7. 코드 중복 제거 및 유틸리티 통합
- [ ] 8. 테스트 커버리지 확충 및 문서화

- [x] 6. 메모리 관리 개선 - blob URL 정리 강화 (releaseProjectBlobUrls, trackBlobUrl 추가)
- [x] 7. 코드 중복 제거 및 유틸리티 통합 (common.ts 추가, validateRewriteContent 추가)
- [x] 8. 테스트 커버리지 확충 및 문서화 (hooks.test.ts 추가, 주요 유틸리티 테스트)
