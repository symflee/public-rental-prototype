# 공공임대 지도 프로토타입

공공임대 주택 위치 탐색 서비스를 위한 Next.js 프로젝트입니다.
현재 단계에는 프로젝트 스캐폴드만 포함하며 지도, 데이터, 알림 기능은 구현하지 않습니다.

## 요구 환경

- Node.js 24 LTS
- pnpm 11.9.0

## 시작하기

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

환경변수가 비어 있어도 준비 화면은 `http://localhost:3000`에서 정상적으로 열립니다.
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

## 의존성 보안

`pnpm-workspace.yaml`은 Next.js가 아직 고정하고 있는 PostCSS와 Sharp를 보안 패치
버전으로 override합니다. `brace-expansion` advisory는 ESLint의 개발 전용 의존성에만
해당하며, 패치된 메이저 버전을 강제하면 현재 lint 체인이 깨지므로 명시적으로
감사 예외 처리했습니다. lint 의존성이 업데이트되면 해당 예외를 제거합니다.

## 저장소 구조

- `src/app`: Next.js 라우트와 의존성 조립
- `src/components/ui`: 공용 표현 컴포넌트
- `src/features`: 지도, 주택, 공고, 알림 데모 기능
- `src/domain`: 프레임워크 독립적인 도메인 규칙
- `src/infrastructure`: Kakao와 Supabase 같은 외부 시스템 어댑터
- `tests/setup`: 테스트 공용 설정
- `tests/e2e`: 주요 브라우저 사용자 흐름

아직 구현 파일이 없는 디렉터리는 미리 커밋하지 않고 기능을 시작할 때 추가합니다.
구체적인 의존성 규칙은 [AGENTS.md](./AGENTS.md)를 따릅니다.

## Git 관리

- `.env.example`은 환경변수 이름만 담아 원격 저장소에 공유합니다.
- `.env.local`은 실제 로컬 값이므로 Git에서 제외합니다.
- `.codex/`는 개인 작업 맥락과 기록을 보관하며 Git에서 제외합니다.
- `.next/`, 테스트 결과, IDE 설정, 로컬 pnpm 저장소는 생성물이므로 Git에서 제외합니다.

## 다음 단계: 카카오 지도 확인

1. Kakao Developers의 JavaScript SDK 도메인에 `http://localhost:3000`을 등록합니다.
2. `.env.local`의 `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`에 JavaScript 키를 넣습니다.
3. `src/infrastructure/kakao`에 SDK 로더를 구현합니다.
4. `src/features/map`에 전체 화면 지도 컴포넌트를 구현합니다.
5. 성남시청 인근 중심 좌표로 기본 지도가 표시되는지만 확인합니다.

마커, 클러스터, Supabase, CSV, 알림 기능은 기본 지도 확인 이후에 추가합니다.
