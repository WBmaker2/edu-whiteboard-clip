# 판서랩 (PanseoLab) · 교육용 화이트보드 영상 만들기

수업 주제만 입력하면 AI가 5단계 스토리보드를 만들고, 한국어 나레이션과 손그림 판서 애니메이션을 캔버스에 그려 영상 파일까지 내보내는 브라우저 앱입니다.

**라이브 데모:** https://wbmaker2.github.io/edu-whiteboard-clip/

`animator-kohl.vercel.app`의 동작과 화면 구조를 리버스 엔지니어링으로 분석한 뒤, 원본의 코드·에셋·문구를 복사하지 않고 새로 구현한 클린룸 프로젝트입니다.

## 주요 기능

### 스튜디오 (P0)
- Gemini API 키 입력·확인·브라우저 저장(선택), 무료 키 안내
- 수업 주제 입력 + 추천 템플릿 6종
- 그래픽 표현 3종(정밀 다이어그램 / 컬러 일러스트 / 마커 스케치) + 주제 자동 추천
- 연출 스타일 10종: 스마트 적응형(장면마다 AI가 배치 선택) + 플로우 / 마인드맵 / 비교·대조 / 인포그래픽 / 타임라인 / 순환 / 계층도 / 데이터 차트 / 벤다이어그램
- 디자인 테마 4종(페이퍼 / 블루프린트 / 웜 에디토리얼 / 미드나잇) + 주제 자동 추천
- Gemini 모델·TTS 모델·보이스 선택, 모델 자동 폴백

### 영상 모니터 (P0)
- 1920×1080 캔버스에 장면별 손그림 판서 애니메이션
- 재생·일시정지·시크·배속(0.75×~1.5×), 씬 탭 이동
- 자막(CC) 켜기/끄기, 씬별 내레이션 표시
- 예시 프로젝트(광합성 5씬)로 API 키 없이 전체 흐름 체험

### 스토리보드 큐시트 (P0)
- 씬별 제목·요약·핵심 비트 확인
- 제목/설명/나레이션 인라인 수정, 장면 유형(도입/전개/정리) 변경
- 씬 추가·복제·삭제·순서 이동, 비트 2~5개 추가·삭제·이동
- 씬별 AI 음성 다시 만들기, 내 목소리 녹음
- 장면 단위 AI 재작성: 지시 프리셋, 비트 수 선택, 현재안과 diff 비교, 음성 동시 생성
- 대본 변경 시 “음성 업데이트 필요” 배지로 오래된 음성 표시
- 자동 저장(1.5초 디바운스), 수동 스냅샷, 저장 기록 복원
- Undo/Redo 50단계(Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z)

### 내보내기 (P0/P1)
- WebM(VP9/Opus) 실시간 인코딩: MediaRecorder + EBML duration 패치로 길이 정보 보정
- MP4(H.264/AAC): WebCodecs 오프라인 인코딩으로 실시간보다 빠르게 생성, 미지원 브라우저는 WebM 자동 폴백
- PNG 스냅샷, SRT 자막, 프로젝트 JSON
- FHD 1080p / 고속 720p 선택, 내보내기 형식 선택

### 무료 티어 안전 장치 (P0)
- Gemini 요청 큐: 동시 2개, 최소 1.2초 간격, 429 Retry-After와 지수 백오프
- 생성 전 예상 호출 수 표시(“스토리보드 1회 + 음성 5회 = 6회”), 세션 사용량 표시
- “나레이션 음성도 함께 생성” 해제 시 호출 1회로 스토리보드만 생성
- 동일 내용 재호출 방지: 오디오는 프로젝트에 저장되고 자동 저장/Undo 시 재호출하지 않음
- 장면 재작성은 텍스트 1회(+음성 1회)로 제한하고 결과 확인 후에만 적용

### 수업 자료 (P1)
- A4 요약 학습지: 핵심 정리, 빈칸 퀴즈, 4지선다, 서술형 루브릭 / 학생용·교사용 / 인쇄·PDF
- AI 웹 퀴즈: 즉석 문항 생성, 자동 채점, 해설, 선택적 AI 서술형 첨삭
- 썸네일(16:9)과 카드뉴스(1:1) 5장 생성·다운로드
- 교사용 발표 모드: 판서 공개 단계, 레이저·펜·형광펜·지우기, 강의 가이드, 단축키
- 배경 음악 3종(절차 합성), 볼륨·자동 덕킹
- 자막 언어 선택 및 Gemini 자동 번역(선택)

### 공유·배포 · 확장 (V3)
- 읽기 전용 공유 링크: 프로젝트 데이터를 URL에 압축해 서버 없이 공유(오디오·이미지 제외, 8KB 가드)
- 학생용 퀴즈 링크: 기기 내 채점, 결과 이미지/JSON 저장, 서버 미전송
- 이미지·수식 삽입: 장면 비트마다 사진 첨부 또는 LaTeX 수식(KaTeX)을 테이프 사진 스타일로 표시
- AI 이미지 생성: 비트에 설명을 입력하면 Gemini가 그림을 만들어 판서와 함께 표시(Imagen 우선, 무료 티어는 Gemini 이미지 모델로 자동 대체)
- 세로 9:16 숏폼: 세로 스택 배치와 1080×1920 MP4/WebM 내보내기
- PWA: 설치형 사용과 오프라인 편집·재생·내보내기(오프라인 배너 표시)
- 내 템플릿: 주제·테마·연출·비율 저장, JSON 파일로 주고받기
- 표시 언어 한국어/영어 전환(주요 창 전체), 학교급·교과·성취기준 프롬프트 연계
- WebM→MP4 변환(ffmpeg.wasm): H.264 없는 브라우저용, 최초 1회 약 31MB 다운로드
- SVG 벡터 시트 내보내기(간이 레이아웃)

## 시작하기

```bash
npm install
npm run dev
```

`http://localhost:5173`에서 실행됩니다.

### API 키

1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 Gemini API 키를 발급받습니다.
2. 앱 상단 `GEMINI API KEY` 카드에 입력하고 `키 확인`을 누릅니다.
3. “이 브라우저에만 키 저장”을 체크하면 localStorage에 보관하고, 해제하면 현재 세션에서만 사용합니다.

키가 없어도 `API 키 없이 예시 프로젝트로 먼저 둘러보기`를 누르면 전체 기능을 체험할 수 있습니다(예시는 무음).

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint 검사 |
| `npm run test:run` | Vitest 단위 테스트 실행 |
| `npm run qa:smoke` | 브라우저 스모크 테스트 (`npm run dev` 실행 후, 기본 5173 포트) |
| `npm run qa:ai` | AI 생성 모킹 포함 브라우저 테스트 |
| `npm run qa:v2` | 장면 편집·자동 저장·Undo·AI 재작성·WebM duration QA |
| `npm run qa:layouts` | 5비트 기준 연출 레이아웃 렌더링 QA |
| `npm run qa:pixel` | 캔버스 렌더러 골든 픽셀 비교(리팩터링 안전망, macOS 기준 골든) |
| `npm run qa:a11y` | axe 기반 접근성 검사(심각·치명 위반 0 목표) |
| `npm run qa:media` | 이미지·수식·SVG·JSON 왕복 수업자료 QA |
| `npm run qa:share` | 공유 링크 생성·뷰어 재생·가져오기 QA |
| `npm run qa:quiz` | 학생용 퀴즈 링크·채점·결과 저장 QA |
| `npm run qa:pwa` | 빌드 미리보기에서 서비스 워커·오프라인 동작 QA |
| `npm run qa:ffmpeg` | WebM→MP4(ffmpeg.wasm) 변환 QA (약 31MB 최초 다운로드, 로컬 전용) |
| `npm run qa:mp4` | MP4(H.264/AAC) 내보내기 QA (H.264를 지원하는 Chrome 실행 파일 필요) |
| `npm run qa:all` | 스모크·V2·AI·수업자료·접근성·PWA QA 연속 실행 |

브라우저 테스트는 Playwright Chromium을 사용하며, 최초 1회 `npx playwright install chromium`이 필요합니다.
`npm run qa:v2`의 영상 길이 검증에는 시스템 `ffprobe`(ffmpeg)가 필요합니다.
개발 서버가 다른 포트에서 실행 중이면 `QA_BASE_URL=http://localhost:포트 npm run qa:smoke`처럼 주소를 지정할 수 있습니다.
Playwright Chromium은 H.264 인코더가 없어 MP4 QA는 Chrome for Testing 같은 H.264 지원 브라우저가 필요합니다:
`QA_CHROME="/path/to/Google Chrome for Testing" npm run qa:mp4`

## 프로젝트 구조

```
src/
  App.tsx                     # 화면 오케스트레이션, 생성/내보내기 흐름
  components/                 # 헤더, 설정, 모니터, 큐시트, 모달, 발표 모드, 오류 경계
  data/presets.ts             # 테마·표현·연출·모델·보이스·BGM 정의
  data/demoProject.ts         # API 키 없는 예시 프로젝트
  hooks/usePlayback.ts        # 캔버스 + WebAudio 재생 루프
  hooks/useRecorder.ts        # 내 목소리 녹음
  lib/gemini.ts               # Gemini REST 호출, 폴백, 키 마스킹, 타임아웃·취소
  lib/geminiQueue.ts          # 무료 티어 요청 큐·백오프·타임아웃
  lib/requestBudget.ts        # 예상 호출 수·세션 사용량
  lib/fonts.ts                # 내보내기 전 글꼴 로딩 대기
  lib/download.ts             # 파일 내려받기·파일명 정리 공용 헬퍼
  lib/assets.ts               # 이미지·수식 에셋 생성·디코딩·사전 로드
  lib/i18n.ts                 # 한국어/영어 사전과 t() 헬퍼
  lib/templates.ts            # 사용자 템플릿 저장·내보내기·가져오기
  lib/share.ts                # 공유 링크·퀴즈 링크 인코딩/디코딩
  lib/imageGen.ts             # AI 이미지 생성(Imagen/Gemini 이미지 모델, 대기열·대체 경로)
  lib/narration.ts            # 장면 나레이션 음성 생성 공용 헬퍼
  lib/storyboard.ts           # 프롬프트, JSON 정규화·검증
  lib/rewrite.ts              # 장면 단위 AI 재작성
  lib/sceneOps.ts             # 씬/비트 편집, 오디오 stale 판정
  lib/history.ts              # Undo/Redo 스택
  lib/bgm.ts                  # 절차 BGM 스케줄러(온라인/오프라인 공용)
  lib/tts.ts                  # PCM→WAV, 무음 분석, 비트 윈도우
  lib/audioEngine.ts          # WebAudio 재생·믹싱·BGM·덕킹·녹음 스트림
  lib/renderer/               # 캔버스 렌더러(코어·배경·스케치·가로/세로 레이아웃)와 아이콘
  lib/export/                 # WebM·MP4(워커)·ffmpeg 변환·SVG·SRT·JSON·이미지·수업 자료
  lib/worksheet.ts, quiz.ts   # 학습지·퀴즈 로컬 생성
  store/studioStore.ts        # Zustand 스토어(설정 영속화·히스토리)
  styles/                     # 기본·스튜디오·모니터·창·반응형 스타일 분할
```

## 브라우저 지원과 한계

- Chrome/Edge 최신 버전 권장. Safari는 일부 미디어 기능이 제한될 수 있습니다.
- WebM(VP9/Opus)은 모든 최신 브라우저에서 동작하며, duration 메타데이터를 보정해 저장합니다.
- MP4(H.264/AAC)는 WebCodecs 인코더가 있는 브라우저(Chrome/Edge, Chrome for Testing)에서 백그라운드 워커로 인코딩되어 내보내는 동안 화면이 덜 멈춥니다. 워커를 쓸 수 없는 환경에서는 기존 방식으로 자동 전환됩니다.
- WebM 내보내기는 실제 재생 시간만큼 걸립니다. MP4는 재생 시간보다 빠르게 끝나지만 완료까지 탭을 닫지 마세요.
- 내 목소리 녹음은 마이크 권한이 필요합니다.
- 프로젝트 초안은 브라우저 IndexedDB에 저장됩니다. 브라우저 데이터를 삭제하면 사라집니다.
- API 키는 브라우저에서 Gemini로 직접 전송됩니다. 공용 PC에서는 “브라우저에만 키 저장”을 해제하세요.
- 다국어 자막 번역과 AI 서술형 첨삭에는 Gemini API 키가 필요합니다.
- 표시 언어(한국어/영어)는 주요 창에 적용되며, 일부 교과·성취기준 데이터 라벨은 한국어로 표시됩니다.
- AI 이미지 생성은 Gemini 이미지 모델을 사용하며 무료 티어 한도(분당·일일 요청 수)의 영향을 받습니다. 한도가 막히면 업로드·수식 삽입을 사용하세요.
- 공유 링크는 오디오·이미지를 포함하지 않으며(URL 8KB 가드), 훨씬 큰 프로젝트는 JSON 파일 공유를 사용합니다.
- WebM→MP4 변환은 최초 1회 약 31MB 도구를 내려받으며 로컬 변환이라 영상 길이에 따라 시간이 걸립니다.
- 학생용 퀴즈 결과는 서버에 수집되지 않아 학생이 결과 파일을 직접 제출해야 합니다.

## 테스트

- Vitest 83개 단위 테스트: 시간 계산, 스토리보드 정규화, WAV·윈도우, SRT, JSON 왕복(v1 마이그레이션·v2 에셋 포함), 학습지·퀴즈, 앱 렌더, 히스토리, 씬/비트 편집, 요청 큐(타임아웃·취소), 장면 재작성, 오디오 stale 판정, 파일명 정리, 설정 동기화, 오류 경계, i18n 사전 일치, 교육과정 프롬프트, AI 이미지 응답 처리·모델 선택
- Playwright 스모크 17개: 예시 재생, JSON/SRT/PNG 내보내기, 초안 저장·불러오기, 학습지·퀴즈·자료·발표 모드, JSON 가져오기, 영상 내보내기, 모바일
- Playwright AI 모킹 5개: 스토리보드+TTS 파이프라인, 테마·레이아웃 전환, 오디오 포함 영상 내보내기
- Playwright V2 26개: 장면 추가/이동, 비트 추가, Undo/Redo, 자동 저장·초안 복원, AI 재작성 diff·적용·stale 배지, 저장 기록, WebM duration, 모바일 오버플로
- Playwright MP4 4개: H.264/AAC 코덱, 확장자, duration 검증(Chrome for Testing)
- Playwright 접근성: axe로 설정·모니터·도움말·저장 기록 화면 검사(심각·치명 위반 0)
- Playwright 픽셀 회귀 9개: 레이아웃 4종·포스터·아웃트로 + 세로 인트로/장면 골든 비교(`QA_PIXEL_UPDATE=1`로 골든 갱신)
- Playwright 수업자료: 수식 입력·이미지 첨부·재생 반영·JSON 왕복·SVG 내보내기·영상 내보내기
- Playwright 공유·퀴즈: 링크 생성/뷰어/가져오기, 퀴즈 채점·결과 저장
- Playwright PWA: 서비스 워커·오프라인 재로드·오프라인 배지
- Playwright ffmpeg: WebM→MP4 변환(약 31MB 최초 다운로드, 로컬 전용)

## 라이선스와 고지

- 이 저장소의 코드: MIT
- Pretendard 폰트: SIL Open Font License 1.1
- Lucide 아이콘: ISC License
- 원본 `animator-kohl.vercel.app`의 코드·에셋은 사용하지 않았으며, 화면 구조와 동작 방식만 참고했습니다.
