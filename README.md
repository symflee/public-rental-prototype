# 공공임대 지도 프로토타입

공공임대 주택 위치 탐색 서비스를 위한 Next.js 프로젝트입니다.
현재 단계에는 성남시청 인근을 중심으로 한 전체 화면 카카오맵 연결까지 포함합니다.
마커, 클러스터, 검색, 상세 패널, 데이터베이스, 알림 기능은 아직 구현하지 않습니다.

## 요구 환경

- Node.js 24 LTS
- pnpm 11.9.0

## 시작하기

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

카카오 Developers에서 다음 설정을 마친 뒤 `.env.local`에 JavaScript 키를 입력합니다.

1. 카카오맵 API 사용 설정을 켭니다.
2. JavaScript SDK 도메인에 `http://localhost:3000`을 등록합니다.
3. `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`에 JavaScript 키를 입력합니다.

개발 서버를 열면 `http://localhost:3000`에 성남시청 중심의 기본 지도가 표시됩니다.
키가 없거나 SDK를 불러오지 못하면 화면에 원인을 확인할 수 있는 안내가 표시됩니다.
`NEXT_PUBLIC_*` 값은 브라우저에 공개되므로 비밀키나 Supabase 서비스 역할 키를 넣지 않습니다.

## 명령어

| 명령어            | 역할                                    |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | 개발 서버 실행                          |
| `pnpm build`      | 프로덕션 빌드                           |
| `pnpm lint`       | ESLint 검사                             |
| `pnpm format`     | Prettier 포맷 적용                      |
| `pnpm typecheck`  | TypeScript 타입 검사                    |
| `pnpm test`       | Vitest 단위 테스트                      |
| `pnpm test:watch` | Vitest 감시 모드                        |
| `pnpm test:e2e`   | Playwright E2E 테스트                   |
| `pnpm verify`     | lint, 타입, 단위 테스트, 빌드 순차 검증 |

Playwright를 처음 실행하는 환경에서는 브라우저를 한 번 설치합니다.

```bash
pnpm exec playwright install chromium
```

`pnpm test:e2e`는 실제 카카오 지도 타일이 준비되는지 확인하므로 위의 로컬 키와
카카오 Developers 설정이 필요합니다.

## 의존성 보안

`pnpm-workspace.yaml`은 Next.js가 아직 고정하고 있는 PostCSS와 Sharp를 보안 패치
버전으로 override합니다. `brace-expansion` advisory는 ESLint의 개발 전용 의존성에만
해당하며, 패치된 메이저 버전을 강제하면 현재 lint 체인이 깨지므로 명시적으로
감사 예외 처리했습니다. lint 의존성이 업데이트되면 해당 예외를 제거합니다.

## 저장소 구조

- `src/app`: Next.js 라우트와 의존성 조립
- `src/features/map`: 카카오맵 화면과 로딩·오류 상태
- `src/infrastructure/kakao`: 카카오 SDK 로더와 지도 어댑터
- `tests/setup`: 테스트 공용 설정
- `tests/e2e`: 주요 브라우저 사용자 흐름

아직 구현 파일이 없는 디렉터리는 미리 커밋하지 않고 기능을 시작할 때 추가합니다.
구체적인 의존성 규칙은 [AGENTS.md](./AGENTS.md)를 따릅니다.

## Git 관리

- `.env.example`은 환경변수 이름만 담아 원격 저장소에 공유합니다.
- `.env.local`은 실제 로컬 값이므로 Git에서 제외합니다.
- `.codex/`는 개인 작업 맥락과 기록을 보관하며 Git에서 제외합니다.
- `.next/`, 테스트 결과, IDE 설정, 로컬 pnpm 저장소는 생성물이므로 Git에서 제외합니다.

## 카카오 지도 연결 범위

- 카카오 SDK는 `autoload=false`로 한 번만 로드합니다.
- 지도는 성남시청 좌표 `37.420035, 127.127243`, 확대 수준 `5`로 시작합니다.
- 공식 `tilesloaded` 이벤트 이후에만 준비 완료로 표시합니다.
- 기본 드래그와 휠 확대·축소를 사용할 수 있습니다.

Vercel에 배포할 때는 발급된 배포 도메인과 사용하는 커스텀 도메인을 카카오
Developers의 JavaScript SDK 도메인에 추가해야 합니다.
