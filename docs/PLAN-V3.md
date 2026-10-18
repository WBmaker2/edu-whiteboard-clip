# 판서랩 V3 발전 계획 (A~D 전체)

> 진행 상태: **A 완료(0.2.0) · C 완료(0.3.0) · B·D 완료(0.4.0)**
> 부분 범위: B5 다국어는 핵심 화면(헤더·설정·모니터·플레이어·큐시트) 우선 적용, 나머지 창은 후속 추출
> B1b Imagen은 계획대로 플래그 스텁만(실연동 보류) · C5는 검증 결과 Tailwind 유지로 판정(사유: preflight가 시각 기준선)
>
> 대상: `edu-whiteboard-clip` (판서랩) · 선행 문서: `docs/IMPLEMENTATION_PLAN.md`, `docs/PLAN-V2.md`
> 범위: A(안정성) → C(구조·성능) → B(제품 확장) → D(장기) 전체
> 정책(확정): **로그인 없이, 서버 없이** — 100% 브라우저 앱을 유지한다.
> 확정 사항: 계정·클라우드 동기화(Firebase 등) 제외, AI 이미지 생성은 업로드·수식 우선(Imagen은 플래그 스텁만), 다국어는 ko+en
> 원칙: 단계마다 lint/test/build + QA 그린 유지, `docs/UPDATELOG.md` 기록, 클린룸 유지

## 1. 범위 요약

| 단계 | 항목 | 크기 | 의존성 |
|---|---|---|---|
| A | A1 ErrorBoundary · A2 폰트 게이팅 · A3 테마 Undo 버그 · A4 죽은 상태 정리 · A5 다운로드 통합 · A6 Gemini 타임아웃/취소 · A7 CI 강화 · A8 접근성 1차 | S~M | 없음 |
| C | C1 렌더러 모듈화+캐시+펜촉 · C2 Zustand selector · C3 코드 스플리팅 · C4 MP4 워커 · C5 스타일 분할 · C6 중복 통합 2차 | M~L | C1은 B2·D3 선행 |
| B | B1 이미지·수식 삽입 · B2 9:16 세로형 · B3 PWA · B6 템플릿 확장 · B5 다국어(ko/en) · B4a 링크 공유 · B4c 퀴즈 링크 서버리스 배포 · B1b Imagen 플래그 스텁 | S~L | B2←C1, B4c←B4a |
| D | D2 교육과정 연계 · D1 ffmpeg.wasm MP4 · D3 SVG 내보내기(실험) | S~L | D3←C1 |

**실행 순서:** A → C1·C2 → C3·C5·C6·C4 → B1 → B2 → B3·B6 → B5 → B4a → B4c → B1b(스텁) → D2 → D1 → D3 → 마감

## 2. 정책과 제약 (로그인·서버 없이)

- 앱은 계속 100% 브라우저에서 동작한다. 자체 백엔드·계정·클라우드 동기화를 두지 않는다.
- 외부 호출은 기존과 동일하게 사용자 키 기반 Gemini API(BYOK)와 정적 CDN(폰트, ffmpeg.wasm, Playwright QA)뿐이다.
- 기기 간 이동은 프로젝트 JSON 내보내기/가져오기(수동)로 한다. PWA(B3)로 설치형 사용성을 보완한다.
- 공유는 서버 저장 없이 두 가지 방식만 제공한다.
  - 링크 공유(B4a): 프로젝트 데이터를 URL 자체에 압축 삽입. 오디오·이미지 에셋 제외, URL 8KB 이하 가드.
  - 파일 공유: 기존 `.panseolab.json` 내보내기/가져오기.
- 퀴즈 배포(B4c)는 서버리스 축소판으로 한다. 학생 응답은 어느 서버에도 저장되지 않는다(집계·대시보드 없음).

## 3. 공통 규칙

- 각 항목 DoD: `lint` + `test:run` + `build` + 해당 QA 통과 + `docs/UPDATELOG.md` 오늘 날짜 기록(쉬운 말, 관리자 모드 언급 금지)
- 새 화면·플로우의 다음 단계 버튼(공유 복사, 템플릿 적용 등)에 기존 `btn-pulse` 적용
- 골든 이미지 갱신은 의도된 시각 변경일 때만, 사유를 UPDATELOG에 기록
- 버전: 국면 종료 시 `package.json` 소수 증가(0.2.0 → 0.3.0 → 0.4.0 → 0.5.0)

---

## 4. Phase A — 안정성·기반 정비

### A1. ErrorBoundary + 재생 루프 보호
- 신규 `src/components/ErrorBoundary.tsx`(클래스), `src/main.tsx`에서 `<App/>` 감싸기
- 폴백 UI: "다시 불러오기", "초안 내려받기"(IndexedDB `loadDraft` → JSON), "데이터 초기화" 안내
- `src/hooks/usePlayback.ts`: 프레임 렌더 try/catch → 재생 중지 + 토스트(앱 크래시 방지)
- 테스트: 렌더 중 throw → 폴백 노출 단위 테스트

### A2. 내보내기 폰트 로딩 게이팅
- 신규 `src/lib/fonts.ts`: `ensureExportFonts()` — 사용 굵기 `document.fonts.load` + `fonts.ready` 대기, 3초 타임아웃
- 적용: `export/video.ts`, `export/mp4.ts`, `export/materials.ts` 시작 시 + 앱 마운트 prefetch
- 배경: CDN Pretendard 미로드 상태 내보내기 시 폴백 폰트로 렌더되는 버그

### A3. 설정↔프로젝트 동기화를 스토어 액션으로 (테마 Undo 버그)
- 문제: `App.tsx` effect가 `setState` 직접 반영 → Undo 미기록·자동저장 오염
- 해결: `store.setTheme/setVisualStyle/setLayoutStyle/setBgmId`가 설정+프로젝트를 원자 갱신, 프로젝트 존재 시 `applyEdit` 경유(히스토리 1회). App effect 제거
- 테스트: 테마 변경 → Undo 복원, `qa:v2`에 테마 Undo 케이스 추가

### A4. 죽은 상태·중복 스로틀 정리
- 스토어 `currentTime`·`isPlaying`(참조 0곳) 제거, `uid` → `crypto.randomUUID`(폴백 유지)
- `App.tsx` `runWithConcurrency` 제거 — `geminiQueue`가 유일 스로틀
- `penTip` no-op 토글은 C1-4에서 연결, 불가 시 제거

### A5. 다운로드·파일명 로직 통합
- 신규 `src/lib/download.ts`: `downloadBlob()`, `sanitizeFileName()`
- 교체: `App.tsx`, `export/srt.ts`, `export/project.ts`, `export/image.ts`, `export/materials.ts`

### A6. Gemini 요청 타임아웃·취소
- `geminiQueue.run`에 `timeoutMs`(기본 120초, TTS 180초) + AbortController, 타임아웃 시 슬롯 반환 보장
- 생성·재작성 흐름에 "취소" 연결. 테스트: 타임아웃 reject·슬롯 반환, 모킹 취소 QA

### A7. CI 강화
- 신규 `.github/workflows/ci.yml`: lint → test:run → build → Playwright 설치 → `qa:smoke`+`qa:v2`+`qa:ai`(dev 서버 자동 기동)
- `deploy.yml`에 lint/test 추가, 로컬용 `qa:all` 추가

### A8. 접근성 1차
- `Modal.tsx`: 초기 포커스, Tab 트랩, 포커스 복원, `aria-labelledby`
- `VideoExportModal`: 공용 Modal 전환(Esc·백드롭 닫기)
- `HeaderTabs` 방향키/Enter/Esc + roving tabindex, `MonitorPanel` 씬 탭 좌우 이동·`tabpanel`
- 신규 `scripts/qa-a11y.mjs`(@axe-core/playwright): critical/serious 0

---

## 5. Phase C — 구조·성능

### C1. 렌더러 모듈화 + 캐시 + 펜촉 커서
- **골든 픽셀 테스트 선행**(안전망): `scripts/qa-pixel.mjs`(pixelmatch), `tests/fixtures/golden/*.png` — 16:9 5레이아웃×2시점, diff < 0.5%
- `renderer/index.ts` → `renderer/{metrics,canvas,sketch,caption,poster,cache}.ts` + `renderer/layouts/{flow,mindmap,comparison,infographic,intro,outro}.ts`, 공개 API 유지
- 공통 헬퍼 `drawCard/drawIconNode/drawRing/drawUnderline`, `textCache`, `pathCache`, 배경+그리드+헤더 정적 레이어 캐시
- **C1-4 펜촉 커서**: `strokeSketch` 진행 지점 반환 → `penTip` 옵션 시 닙 표시(미리보기·발표·내보내기 공통). 불가 시 토글 제거
- `drawIntro` 하드코딩 문구를 비트 수 대응으로 수정
- DoD: `qa:layouts`+`qa:pixel`+기존 QA 전부 통과

### C2. Zustand selector 분리 + 슬라이스
- `store/slices/{settings,project,ui}.ts` 분리, 파생 훅(`useSettings` 등, `useShallow`)
- 전체 구독 10곳 교체. DoD: 토스트/진행률 시 무관 리렌더 없음, 테스트 통과

### C3. 코드 스플리팅
- `React.lazy`+`Suspense`: 7개 모달 + `PresentationMode`
- 목표: 초기 JS 460KB → 300KB 이하(raw). init 청크 감소 수치 기록

### C4. MP4 인코딩 워커 분리
- 메인(프레임 렌더 → ImageBitmap transfer) + 워커(`mp4Worker.ts`: 인코딩·mux), 오디오 믹스는 메인 유지 → Float32 transfer
- 워커 ack 백프레셔 + UI 양보, 미지원 시 기존 `mp4.ts` 폴백
- DoD: `qa:mp4` 워커/폴백 두 경로 통과, 내보내기 중 UI 응답 확인

### C5. 스타일 분할 + Tailwind 정리
- `styles.css` → `src/styles/` 하위 분할. Tailwind 미사용 확인 시 의존성 제거(근거 기록)
- DoD: `qa:pixel` 시각 회귀 없음, CSS 크기 전후 기록

### C6. 중복 로직 통합 2차
- API 키 확인+토스트+TTS 헬퍼 → `src/lib/narration.ts`(App·StoryboardList 공용)
- `usePlayback.selectScene` → `lib/time.sceneStart` 통일, `materials.ts` 헬퍼 렌더러 유틸 재사용

---

## 6. Phase B — 제품 확장

### B1. 이미지·수식 삽입
- 스키마 v2(§8): `Project.assets`, `Beat.visual`
- 편집 UI(비트 행): 이미지 업로드(클릭·드래그), 수식 입력(KaTeX 미리보기 → `html-to-image` PNG 굽기, latex 원문 보존), 삭제, 캡션
- 렌더러: 레이아웃별 비주얼 슬롯 + 테이프/폴라로이드 스타일, 비트 공개 타이밍 페이드+스케일
- 저장: Blob은 IndexedDB(오디오와 동일), `audioUrls` → `blobUrls` 일반화, JSON base64(+용량 경고), 내보내기 전 `createImageBitmap` 사전 디코드
- katex·html-to-image는 수식 편집기 열 때 dynamic import
- QA 신규 `qa:media`: 첨부 → 재생 → WebM 내보내기 → JSON 왕복

### B2. 9:16 세로형
- `renderer/metrics.ts`: `AspectProfile`(크기·세이프존·헤더·자막), 16:9 기존 값 보존
- 레이아웃 세로 변형 6종(스택/세로 카드/세로 비교 등), `Project.aspect` + 설정 방향 토글
- `RESOLUTIONS`에 1080×1920·720×1280 추가, WebM/MP4 scaleX/scaleY 분리
- 미리보기·발표 모드 비율 반영(학습지·썸네일은 유지). QA: 세로 골든+`qa:mp4` 세로 1건

### B3. PWA·오프라인
- `vite-plugin-pwa`(generateSW): 셸 precache, 폰트 CacheFirst, Gemini NetworkOnly
- manifest(아이콘 192/512/maskable), 오프라인 배너("AI 생성 불가, 편집·내보내기 동작")
- QA 신규 `qa:pwa`: SW 등록 + 오프라인 재로드에서 예시 재생·내보내기

### B6. 템플릿 확장·사용자 템플릿
- 내장 6 → 12+ (과학/수학/국어/사회/역사/영어 예시), 사용자 템플릿 저장/목록/적용/삭제/JSON 공유(IndexedDB `templates`), 적용 버튼 `btn-pulse`

### B5. 다국어 UI (ko/en)
- `src/lib/i18n` 타입 세이프 사전 + `useI18n()`, 설정 언어, `<html lang>` 동기화
- 화면별 추출 약 300문구. 생성 콘텐츠는 주제 언어 유지
- 테스트: ko/en 키 완전 일치 강제 + 언어 전환 QA 스모크

### B4a. 서버리스 링크 공유
- `src/lib/share.ts`: 오디오·에셋 제외 직렬화 + `lz-string` 압축 → `#view=<data>`
- `ShareViewer`: 읽기 전용 재생·자막, "내 프로젝트로 가져오기", 링크 복사(`btn-pulse`)
- 가드: URL 8KB 초과 안내. QA: 생성 → 새 컨텍스트 재생 → 가져오기

### B4c. 퀴즈 링크 서버리스 배포
- 퀴즈 데이터(문항)를 URL에 압축 삽입한 공개 링크 발급(B4a 방식 재사용)
- 학생: 링크 열기 → 기기에서 채점 → 결과 화면에서 **결과 이미지/JSON 내려받기**
- 집계·응답 수집·교사 대시보드 없음(서버 없음). 결과 제출은 학생 파일 전달로 한정
- QA: 퀴즈 링크 생성 → 새 컨텍스트 채점 → 결과 파일 내려받기

### B1b. AI 이미지 생성 — 플래그 스텁만
- `assets`에 `source: "ai"` 타입과 provider 인터페이스(`src/lib/imageGen.ts`)만 정의, 기본 OFF
- 실 API(Imagen 등) 연동은 무료 티어 확인 후 별도 활성화. UI에는 비노출

---

## 7. Phase D — 장기

### D2. 교육과정(성취기준) 연계
- 설정: 학교급/과목/성취기준 텍스트(선택) → `storyboardPrompt`·`rewrite` 컨텍스트 주입
- `src/data/curriculum.ts`: 교과 목록·예시(기준 DB 전체 내장은 범위 외). 프롬프트 골든 테스트

### D1. ffmpeg.wasm 호환 MP4
- WebCodecs/H.264 없는 브라우저용. `@ffmpeg/ffmpeg` 0.12 단일 스레드 core
- 흐름: MP4 요청 & WebCodecs 불가 → [WebM 즉시 / ffmpeg 변환(약 30MB 동의+진행률)]. single-thread라 COOP/COEP 불필요(GitHub Pages 호환)
- 단위 모킹 + 로컬 수동 `qa:ffmpeg`(CI 제외)

### D3(실험적). SVG 정적 내보내기
- 현재 씬/포스터 정지 프레임 SVG. C1 지오메트리 분리 결과 + lucide path 공유로 직렬화
- 무리 시 아이콘+텍스트 간이 버전. QA: SVG 열림+주요 요소 스모크

---

## 8. 스키마 v2와 마이그레이션

| 필드 | 변경 |
|---|---|
| `Project.version` | 1 → 2 |
| `Project.aspect` | 신규 `"16:9" \| "9:16"` (기본 16:9) |
| `Project.assets` | 신규 `Record<assetId, {kind, blob?, mime, width?, height?, latex?, name?, source}>` |
| `Beat.visual` | 신규 `{kind: "image"\|"formula", assetId, caption?}` |

- `src/lib/migrations.ts`: v1→v2 기본값. 초안·스냅샷·JSON import 전부 경유
- `parseProjectJson`에 테마/스타일 id 화이트리스트 추가. v1 픽스처 유지 + v2 왕복 테스트

## 9. 테스트·QA·CI

- 신규: `qa:pixel`(C1), `qa:a11y`(A8), `qa:media`(B1), `qa:pwa`(B3), `qa:all`
- CI: lint→unit→build→Playwright→smoke/v2/ai. `qa:mp4`는 로컬 유지(문서화)
- README(기능·명령어·한계) 단계별 갱신

## 10. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 렌더러 리팩터 시각 회귀 | 골든 픽셀 선행(C1 첫 단계), diff 임계 관리 |
| MP4 워커 미지원 | 기존 메인 스레드 폴백 유지 |
| ffmpeg 30MB 부담 | 동의 기반 로드, WebM 우선 제안 |
| i18n 누락 | ko/en 키 일치 테스트 CI 포함 |
| 링크 공유 URL 길이 | 8KB 가드 + 오디오·에셋 제외 안내 |
| 세로형 품질 | 골든 이미지 리뷰 + qa:layouts 세로 확장 |

## 11. 범위 외

계정·클라우드 동기화(Firebase 등), 서버 기반 학생 인증·응답 수집·결과 대시보드, 결제, 실시간 공동 편집, 성취기준 전체 DB 내장, Imagen 실연동(플래그 준비만)
