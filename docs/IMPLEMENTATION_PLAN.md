# 교육용 화이트보드 영상 만들기 — 구현 계획 및 결과

> 대상 분석: `https://animator-kohl.vercel.app`
> 방식: 동작·화면 구조만 참고한 클린룸 재구현 (원본 코드·에셋·문구 미사용)
> 범위: P0(핵심) + P1(수업 자료) — **구현 완료**
> 최종 갱신: 2026-10-17
> V2 개선(내보내기·자동 저장/Undo·씬 자유 편집·AI 재작성)은 `docs/PLAN-V2.md` 참고
> 이 문서는 최초 구현 기록입니다. 이후 계획은 `docs/PLAN-V2.md`, `docs/PLAN-V3.md`, `docs/PLAN-V4.md`를 참고하세요.

## 1. 목표

수업 주제를 입력하면 AI가 5단계 스토리보드를 만들고, 한국어 나레이션과 손그림 판서 애니메이션을 캔버스에 렌더링해 재생·편집·영상 내보내기까지 할 수 있는 100% 브라우저 앱을 만든다.

성공 기준과 결과:

| 기준 | 결과 |
| --- | --- |
| 브라우저 제목 `교육용 화이트보드 영상 만들기` | 완료 |
| API 키 없이 예시 프로젝트로 전체 흐름 체험 | 완료(광합성 5씬 무음 예시) |
| Gemini 키로 스토리보드+TTS 생성 | 완료(모킹 브라우저 테스트 통과) |
| 4테마 × 5연출 렌더링, 자막·배속·시크 | 완료 |
| WebM/PNG/SRT/JSON 내보내기·가져오기 | 완료 |
| `lint`·`test`·`build` 통과 | 완료 |

## 2. 리버스 엔지니어링 조사 요약

- Vite + React + Tailwind v4 SPA, 단일 번들, 소스맵 비공개
- 백엔드 없음: `generativelanguage.googleapis.com` 직접 호출, API 키 로컬 저장(선택)
- IndexedDB 초안 저장, Pretendard CDN
- 데이터 계약: `Scene{type,title,subtitle,beats[3],duration,windows,audio}` / `Beat{label,desc,narration,iconType}`
- 파이프라인: 스토리보드 JSON 생성 → 씬별 TTS(PCM 24k → WAV, 무음 분석으로 비트 윈도우) → 캔버스 렌더 → WebAudio 재생 → MediaRecorder 내보내기
- 화면: 설정 패널, 영상 모니터, 스토리보드 큐시트, 발표 모드, A4 학습지, AI 퀴즈, 썸네일/카드 모달

조사 근거는 개발 중 사용한 스크린샷과 번들 분석이며 저장소에는 포함하지 않았습니다.

## 3. 구현 결과 요약

### P0
- 스튜디오 설정: API 키 카드, 주제+템플릿, 표현 3, 연출 5, 테마 4, 모델 2, TTS 모델 2, 보이스 3, 예시 프로젝트
- AI 생성: 자체 작성 프롬프트, JSON 정규화(3~7씬, 3비트 보정, 아이콘 폴백), 모델 폴백, 한국어 오류
- TTS: `responseModalities:["AUDIO"]`, PCM→WAV, 무음 구간 기반 비트 윈도우, 동시 2개 제한
- 렌더러: 1920×1080, 4테마, intro/outro + flow/mindmap/comparison/infographic, 진행형 손그림, 자막 바, 미리보기 프레임
- 플레이어: WebAudio 클록, 재생/일시정지/시크/배속/씬 이동/CC
- 큐시트: 인라인 편집, 씬별 음성 재생성, 내 목소리 녹음, 초안 저장, JSON 가져오기/내보내기
- 내보내기: WebM(VP9/Opus) 실시간 인코딩(720p/1080p), 진행률·취소, PNG, SRT

### P1
- 발표 모드: 판서 1/2/3단계·전체 공개, 레이저/펜/형광펜/지우기, 강의 가이드, 단축키(←/→/1/2/3/L/P/H/C/Esc)
- A4 학습지: 요약·빈칸·4지선다·서술형, 학생용/교사용, 인쇄/PDF
- AI 퀴즈: 즉석 문항, 자동 채점, 해설, 선택적 AI 첨삭
- 썸네일/카드뉴스: 16:9 1장 + 1:1 5장 생성·다운로드
- 배경 음악 3종(절차 합성), 볼륨·덕킹, 자막 언어 7종(선택적 AI 번역)

## 4. 아키텍처

```
설정 → studioStore → Gemini(storyboard/TTS) → Project(scenes+audio)
     → AudioEngine ↔ usePlayback(RAF) ↔ Canvas renderer
     → 큐시트 편집 / 발표 모드 / 내보내기(비디오·이미지·자막·JSON)
```

- 상태: Zustand + persist(설정만), 초안은 IndexedDB(idb-keyval)
- 렌더: 캔버스 2D, 테마 팔레트, Lucide 아이콘 노드를 Path2D로 변환해 26종 글리프 지원
- 오디오: AudioContext 클록, 씬별 AudioBuffer 스케줄링, BGM 절차 합성, `MediaStreamAudioDestinationNode`로 녹음/내보내기 믹싱
- 테스트: Vitest + Testing Library(단위), Playwright(브라우저 QA)

## 5. 마일스톤 상태

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| M0 | 스캐폴드, 타이틀, 디자인 토큰, 앱 셸 | 완료 |
| M1 | 설정 패널, 예시 프로젝트, 포스터 | 완료 |
| M2 | 캔버스 렌더러, 플레이어, 큐시트 | 완료 |
| M3 | Gemini 스토리보드/TTS, 진행 UI, 폴백 | 완료 |
| M4 | 오디오 엔진, BGM, 자막/번역 | 완료 |
| M5 | 초안/JSON/PNG/SRT/녹음 | 완료 |
| M6 | 비디오 내보내기 | 완료 |
| M7 | 발표 모드, 학습지, 퀴즈, 썸네일/카드 | 완료 |
| M8 | 반응형, 접근성, 테스트, 문서, QA | 완료 |

## 6. 검증 결과

- `npm run lint` 통과
- `npm run test:run`: 5개 파일 26개 테스트 통과
- `npm run build`: 타입 검사 + 프로덕션 빌드 통과(약 377KB JS, 120KB gzip)
- `npm run qa:smoke`: 17개 브라우저 검사 통과
  - 예시 재생, JSON/SRT/PNG 내보내기, 초안 저장·불러오기, 학습지·퀴즈·자료·발표 모드, JSON 가져오기, WebM 내보내기, 모바일 레이아웃
- `npm run qa:ai`: 모킹된 Gemini로 스토리보드+TTS 생성, 5씬 AI 음성 적용, 테마·레이아웃 전환, 오디오 포함 WebM(VP9/Opus) 내보내기 통과
- 내보낸 영상 검증: 1920×1080 VP9 + Opus

## 7. 알려진 한계

- MediaRecorder WebM은 일부 플레이어에서 길이 메타데이터가 없을 수 있음(Chrome·YouTube·VLC 재생 가능)
- 비디오 내보내기는 실제 재생 시간만큼 소요되며, 탭 전환 시 느려짐
- Safari는 MediaRecorder·오디오 디코딩 지원 차이가 있음
- 실 API 키가 없는 상태에서는 모킹 테스트로 파이프라인을 검증했으며, 실제 모델 가용성은 계정과 시점에 따라 다름
- SVG 벡터 내보내기(원본의 선택 기능)는 P2로 보류

## 8. 이후(P2) 후보

- SVG 벡터 내보내기, 펜촉 커서 애니메이션, 다국어 UI, MP4 강제 인코딩(ffmpeg.wasm), 클라우드 동기화
