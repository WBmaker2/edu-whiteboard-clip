# 판서랩 V2 개선 계획 및 결과

> 무료 Gemini API 키 환경에서 안전하게 동작하는 1순위 개선 4종
> 승인 범위: WebCodecs MP4 포함, Gemini 요청 큐 최소 간격 1.2초
> 최종 갱신: 2026-10-17 · 구현 완료

## 1. 배경과 제약

- 무료 티어는 모델별 분당/일일 요청 한도가 있고, TTS는 씬 수만큼 호출이 필요합니다.
- 사용자마다 자기 키를 쓰는 구조이므로 전역 요청 큐·예산 표시로 한도 초과를 완화합니다.
- 서버 없이 브라우저에서 끝나는 기능(내보내기, 저장, 편집)을 우선 개선합니다.
- 원본과 마찬가지로 클린룸 구현을 유지합니다.

## 2. 구현된 공통 기반

- `src/lib/geminiQueue.ts`
  - 동시 2개, 최소 1.2초 간격, `Retry-After`/지수 백오프(지터)
  - 모든 Gemini 요청이 단일 큐를 통과
- `src/lib/requestBudget.ts`
  - 생성/재작성/번역/퀴즈 예상 호출 수 계산
  - 세션 누적 호출 수를 `useSyncExternalStore`로 UI에 표시
- `src/lib/audioUrls.ts`
  - Blob당 Object URL 캐시. Undo/히스토리가 이전 Blob을 참조해도 URL이 유지됨
- 프로젝트 스키마는 `version: 1`을 유지하고 선택 필드만 추가
  - `Scene.audioTextHash`, `Scene.updatedAt`

## 3. 내보내기 신뢰성

### 구현
- WebM: MediaRecorder 마무리 절차 보강(requestData → stop, onerror, timeslice 1s, 마지막 프레임 보정)
- WebM duration: `fix-webm-duration`으로 EBML duration을 패치해 `Infinity` 문제 해결
- MP4: `WebCodecs(VideoEncoder/AudioEncoder)` + `mp4-muxer` + `OfflineAudioContext`
  - H.264/AAC, 30fps, FHD/720p, BGM·내레이션 오프라인 믹싱
  - 지원하지 않는 브라우저는 WebM으로 자동 폴백하고 사용자에게 안내
- UI: 모니터 툴바에 WebM/MP4 선택, 내보내기 모달에 형식·예상 동작 안내

### 검증
- Chromium(Playwright): WebM duration 3.0s로 보정됨, H.264 미지원 시 WebM 폴백 확인
- Chrome for Testing: MP4 1920×1080 H.264 + AAC, duration 3.07s 생성 확인

### 알려진 한계
- Playwright 기본 Chromium은 H.264 인코더가 없어 MP4 QA는 Chrome for Testing이 필요합니다.
- MP4는 WebCodecs 지원 브라우저에서만 제공됩니다.

## 4. 자동 저장·버전 복원·Undo/Redo

### 구현
- 자동 저장: 프로젝트 변경 후 1.5초 디바운스로 IndexedDB(`draft:latest`) 저장
- 저장 기록: 최대 10개 스냅샷, 수동 스냅샷과 AI 재작성 전 스냅샷은 오디오 포함
- 저장 기록 모달: 상대 시간, 씬 수, 오디오 포함 여부, 복원/삭제
- 시작 시 초안이 있으면 “이어서 작업 / 새로 시작” 배너
- Undo/Redo: 50단계 메모리 스택, 모든 씬/비트 편집·재작성 적용에 연동
- 단축키 `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`
- Blob URL은 캐시로 유지해 Undo 시에도 오디오가 살아 있음

### 검증
- 편집 → 자동 저장 → 새로고침 → 배너 복원 → 6씬 유지
- Undo/Redo로 장면 추가 취소/복원
- AI 재작성 적용 후 Undo로 이전 제목 복원

## 5. 씬 자유 편집

### 구현
- 씬 2~10개, 비트 2~5개
- 씬 추가·삭제·복제·위/아래 이동, 장면 유형(도입/전개/정리) 변경
- 편집기에서 비트 추가·삭제, 저장 시 윈도우 재계산
- 렌더러 가변 레이아웃
  - intro/outro: 2~5개 노드 균등 배치
  - flow: 2~5개 카드(폭/글자 자동 축소)
  - mindmap: 2~5개 방사형 배치
  - comparison: 2~3개 기존, 4개는 2×2, 5개는 flow 자동 폴백
  - infographic: 2~5개 행 자동 배치
- 발표 모드: 비트 수에 맞춘 1..N 공개 단계 + 전체
- 대본 수정 시 `audioTextHash` 비교로 “음성 업데이트 필요” 배지 표시, 자동 재생성은 하지 않음

### 검증
- 장면 6개·비트 4개 편집, 이동, JSON 왕복 확인
- 스모크·AI QA·V2 QA 전체 통과

## 6. 장면 단위 AI 재작성

### 구현
- `src/lib/rewrite.ts`: 지시 프리셋(더 쉽게/더 짧게/사례 중심/시각자료 중심/오개념 교정) + 자유 지시
- 응답 JSON 정규화(비트 2~4, 아이콘 폴백, 누락 비트 보정)
- `RewriteSceneModal`: 예상 호출 수 표시, 비트 수 선택, “음성도 함께” 토글(기본 OFF), 현재안/제안 diff, 적용/다시 생성/취소
- 적용 시 단일 커밋으로 제목·요약·비트 반영, 음성 미생성 시 stale 배지
- 재작성 전 오디오 포함 스냅샷 생성

### 무료 티어 안전장치
- 텍스트 1회, 음성 생성 선택 시 +1회. 자동 재시도 외 추가 호출 없음
- 같은 요청을 연타해도 큐가 1.2초 간격으로 제한
- 실패 시 현재 장면 유지, 오류 안내만 표시

### 검증
- 모킹 Gemini + 모킹 TTS로 재작성 → 음성 적용 → 대본 수정 → stale 배지 → Undo까지 전체 통과
- 단위 테스트: 정규화, 비트 보정, 아이콘 폴백, 프롬프트

## 7. 무료 티어 호출 예산

| 작업 | 호출 수 |
| --- | --- |
| 전체 생성(스토리보드+TTS 5씬) | 6회 |
| 음성 없이 생성 | 1회 |
| 장면 재작성(텍스트만) | 1회 |
| 장면 재작성 + 음성 | 2회 |
| 자막 번역 | 언어당 씬 수 |
| 퀴즈 생성 | 1회 |

큐 간격 1.2초·동시 2개 기준으로 6회 생성은 약 4~6초의 최소 간격이 추가됩니다.

## 8. 검증 요약

- `npm run lint`: 통과
- `npm run test:run`: 9개 파일 44개 통과
- `npm run build`: 통과(약 460KB JS, 146KB gzip)
- `npm run qa:smoke`: 17/17
- `npm run qa:ai`: 5/5
- `npm run qa:v2`: 26/26
- `npm run qa:mp4`: 4/4 (Chrome for Testing)

## 9. 후속 후보

- 비트 6개 이상 레이아웃, 씬 드래그 앤 드롭, 오프라인 WebM→MP4 변환
- 수식·이미지 삽입, 9:16 세로형, 학습지/퀴즈 확장
- 서버 계정 기반 협업·학생 배포
