# Repository Guidelines

## Development

- TypeScript strict mode를 유지하며 `any`를 사용하지 않는다.
- 기능은 TDD로 구현한다. 순수 마크업과 스타일링만 테스트에서 제외할 수 있다.
- 함수는 한 가지 책임만 가지며 15줄 이내로 유지한다.
- 중첩 깊이는 1을 넘기지 않는다. 가드 절과 함수 분리를 사용한다.
- 삼항 연산자, `else`, `switch`를 사용하지 않는다.
- 이름을 축약하지 않는다.
- 상태와 객체는 작게 유지하고 불필요한 getter와 setter를 만들지 않는다.

## Boundaries

- `src/app`: 라우팅과 의존성 조립
- `src/components/ui`: 재사용 가능한 표현 컴포넌트
- `src/features`: 기능별 UI와 애플리케이션 흐름
- `src/domain`: 프레임워크에 독립적인 타입과 규칙
- `src/infrastructure`: 외부 SDK와 데이터 소스 어댑터
- 구현 파일이 생길 때 디렉터리를 추가하며 빈 플레이스홀더는 커밋하지 않는다.
- UI에 도메인 규칙이나 데이터 접근 코드를 넣지 않는다.
- Kakao SDK 로드, `window.kakao`, SDK 타입 직접 참조는
  `src/infrastructure/kakao` 안에서만 허용한다.
- `src/domain`은 `app`, `features`, `infrastructure`를 import하지 않는다.

## Tests and security

- 새 도메인과 인프라 동작에는 단위 테스트를 함께 추가한다.
- 중요 사용자 흐름에는 Playwright 테스트를 추가한다.
- 완료 전 `pnpm verify`와 필요한 E2E 테스트를 실행한다.
- `.env.local`과 실제 키를 커밋하지 않는다.
- `NEXT_PUBLIC_*`에는 브라우저에 공개되어도 되는 값만 둔다.
