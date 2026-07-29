# 경기도 LH 임대주택 지도

경기도 LH 임대주택과 연결된 모집공고를 정적 스냅샷으로 탐색하는 Next.js
프로토타입입니다. 앱은 실행 중 외부 주소 API를 호출하지 않으며, 목록과 지도 핀은
같은 결정적 위치 ID를 사용합니다.

수집기는 경기도 31개 시·군, 42개 시·군·구 요청 코드에서 다음을 수집합니다.

- LH가 공급하는 운영 중 공공임대 단지
- 단지에 안전하게 연결된 모집 중 공고와 마이홈포털 상세 링크
- 국민임대, 영구임대, 행복주택, 통합공공임대, 공공임대, 매입임대

단대동 행복주택, GH·지방공사, 민간임대, 공공분양, 비주거 임대, 계획사업과
구체 좌표를 만들 수 없는 주소는 포함하지 않습니다.

저장소에는 경기도 전체 앱 스냅샷을 포함합니다. 아래 API 수집 명령은 검증된 최신 결과로
이 스냅샷을 교체합니다.

## 요구 환경

- Node.js 24 또는 26
- pnpm 11.9.0

## 시작하기

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

카카오 Developers에서 지도 사용 설정을 켜고 JavaScript SDK 도메인에
`http://localhost:3000`을 등록합니다. `.env.local`에는 브라우저 공개용 JavaScript
키를 넣습니다.

```dotenv
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=카카오_JavaScript_키
```

`NEXT_PUBLIC_*` 값은 브라우저에 공개됩니다. REST 키나 공공데이터포털 일반인증키를
이 접두사에 넣지 않습니다.

## CSV 수집

원천 파일은 공공데이터포털에서 내려받아 `data/`에 둡니다.

- [LH 건설임대 CSV](https://www.data.go.kr/data/15050700/fileData.do)
- [LH 매입임대 CSV](https://www.data.go.kr/data/15050701/fileData.do)

파일명은 NFC/NFD와 관계없이 `_건설_YYYYMMDD.csv`, `_매입_YYYYMMDD.csv`를 각각
정확히 하나씩 찾습니다. 좌표 캐시에 없는 주소가 있을 때만 서버 전용 Kakao REST
키가 필요합니다.

```dotenv
KAKAO_REST_API_KEY=카카오_REST_API_키
```

```bash
pnpm collect:public-rentals
```

수집기는 다음 순서로 동작합니다.

1. UTF-8 strict 디코딩 후 실패하면 CP949/EUC-KR로 CSV를 읽습니다.
2. 성남시·용인시와 지원 임대유형만 남기고 주소·날짜·숫자를 정규화합니다.
3. 물리 주소를 기준으로 위치를 묶고 복수 단지코드와 공급행을 하위 레코드로 보존합니다.
4. 주소 SHA-256 앞 16자리로 `lh:<city>:<hash>` 위치 ID를 만듭니다.
5. 기존 앱 좌표와 좌표 캐시를 재사용하고, 나머지만 Kakao 주소 검색으로 변환합니다.
6. 시·구 불일치나 검색 실패가 하나라도 있으면 기존 앱 JSON을 덮어쓰지 않습니다.

생성물은 `src/infrastructure/public-data/generated/`에 저장됩니다. 앱 스냅샷 JSON만 저장소에
포함하고, 나머지 검수·캐시 산출물은 로컬에만 둡니다.

- `public-rental-locations.json`: 앱이 읽는 schema v2 스냅샷
- `public-rental-locations.csv`: 위치·주택·공급행 검수 자료
- `public-rental-coordinate-cache.json`: 서버 수집용 좌표 캐시
- `collection-report.json`: 원천별 수집·중복·제외·경고·오류 보고서
- `public-rental-api-failures.json`: 공공데이터 API 요청 실패의 시·군·페이지 검수 목록
- `public-rental-recruitment-failures.json`: 자동 연결하지 못한 LH 모집공고의 수기 검수 목록
- `public-rental-coordinate-failures.json`: 좌표를 확인하지 못한 LH 단지의 수기 검수 목록

일부 매입임대 원문은 건물번호 없이 숫자가 포함된 도로명까지만 제공합니다. Kakao가
반환한 도로 중심 좌표를 사용하되, 해당 위치는 보고서의
`ROAD_LEVEL_ADDRESS_PRECISION` 및 `roadLevelWarnings`에 별도로 남깁니다.

## 경기도 API 수집

경기도 전체 앱 스냅샷은 마이홈포털의 단지정보 API와 모집공고 API를 함께 사용합니다.
두 API 모두 공공데이터포털에서 활용신청한 서버 전용 일반인증키가 필요합니다.

- [공공임대주택 단지정보 API](https://www.data.go.kr/data/15110581/openapi.do)
- [공공주택 모집공고 API](https://www.data.go.kr/data/15108420/openapi.do)

```dotenv
PUBLIC_DATA_PORTAL_SERVICE_KEY=공공데이터포털_일반인증키
KAKAO_REST_API_KEY=카카오_REST_API_키
```

```bash
pnpm collect:public-rentals:gyeonggi
```

수집기는 다음을 모두 확인한 뒤에만 앱 스냅샷을 교체합니다.

1. 경기도 42개 시·군·구 API 요청을 모두 시도하고, 실패한 시·군·페이지는 `public-rental-api-failures.json`에 남긴다. 성공한 응답은 계속 수집한다.
2. LH 단지만 남기고 `hsmpSn`으로 단지를 묶으며, 완전히 같은 공급 조건 행은 제거한다.
3. 모집공고 API에서 LH·진행 중 공고만 남기고 단지 식별자로 연결한다. 식별자가 없을 때만 단지명 정확 일치를 사용한다.
4. 공고 ID·상세 링크·단지 참조가 없거나, 연결되지 않거나, 여러 단지와 충돌한 LH 진행 중 공고는 `public-rental-recruitment-failures.json`에 사유와 식별정보를 남기고 앱 스냅샷에서는 제외한다.
5. Kakao 좌표 변환에 실패한 단지는 `public-rental-coordinate-failures.json`에 사유와 단지 정보를 남기고 앱 스냅샷에서는 제외한다. 좌표가 확인된 단지와 정상적으로 연결된 공고는 계속 반영한다.

개별 API 요청·공고 정규화·공고 연결·좌표 변환 오류는 각각 검수 목록으로 남기고 성공한
데이터를 게시합니다. 단지 데이터가 없거나 좌표가 확인된 단지가 하나도 없을 때만 기존 앱
스냅샷을 유지합니다.

## API 검수 수집 (기존 성남 검수 경로)

공공데이터포털 API 수집기는 앱 스냅샷과 분리해 보존합니다. 이 명령은
`generated/api-review/`만 갱신합니다.

```dotenv
PUBLIC_DATA_PORTAL_SERVICE_KEY=공공데이터포털_일반인증키
KAKAO_REST_API_KEY=카카오_REST_API_키
```

```bash
pnpm collect:public-rentals:api
```

## 지도 기능

- 첫 화면과 필터 변경 시 결과 전체를 bounds로 맞춤
- 6개 임대유형 색상·한글 약자 핀과 복합유형 분할색 핀
- 2개 이상 위치의 클러스터와 클러스터 bounds 확대
- 시·군 단일 선택, 공급유형 다중 선택, 단지명·주소 검색
- 지도 이동 후 사용자가 누를 때만 적용하는 `이 지도 영역에서 보기`
- 목록·핀 선택 동기화와 공급유형별 세대수·면적·공식 출처 상세
- 모집 중 공고 배지와 마이홈포털 공고 상세 링크
- 개인 식별자 없이 집계한 지도 조회·공고 확인 행동 분석
- 데스크톱 384px 패널과 모바일 120px/56dvh 하단 시트
- 색상 외 한글 약자·범례·텍스트·`aria-live` 안내

## 검증 명령

| 명령어                                 | 역할                                   |
| -------------------------------------- | -------------------------------------- |
| `pnpm dev`                             | 개발 서버 실행                         |
| `pnpm build`                           | 프로덕션 빌드                          |
| `pnpm collect:public-rentals`          | CSV 스냅샷·CSV·캐시·보고서 생성        |
| `pnpm collect:public-rentals:gyeonggi` | 경기도 API 스냅샷·모집공고·좌표 생성   |
| `pnpm collect:public-rentals:api`      | API 검수 산출물을 별도 생성            |
| `pnpm analytics:schema`                | Neon 일별 분석 카운터 테이블 생성      |
| `pnpm lint`                            | ESLint 검사                            |
| `pnpm format:check`                    | Prettier 검사                          |
| `pnpm typecheck`                       | TypeScript strict 타입 검사            |
| `pnpm test`                            | Vitest 단위·통합 테스트                |
| `pnpm test:e2e`                        | Playwright 데스크톱·모바일 흐름 검증   |
| `pnpm verify`                          | lint, 타입, 단위 테스트, 프로덕션 빌드 |

Playwright를 처음 실행하는 환경에서는 Chromium을 설치합니다.

```bash
pnpm exec playwright install chromium
```

## 비식별 공고 확인 분석

분석 DB에는 방문자 쿠키, 계정, IP 주소, User-Agent, 브라우저 지문, 개인별 이벤트를
저장하지 않습니다. 한국 시간 기준 일별로 아래 행동 횟수만 합산합니다.

- 지도 조회수
- 실제 공고 열람 클릭 수
- 미연결 단지의 공고 확인 의향 클릭 수

따라서 결과는 고유 사용자 수가 아닌 행동 횟수입니다. 새로고침, 반복 클릭, 자동화 요청도
포함될 수 있습니다. Vercel Marketplace에서 Neon을 연결한 뒤 연결 문자열과 아래 서버 전용
환경 변수를 설정하고 스키마를 한 번 준비합니다.

```dotenv
DATABASE_URL=Neon_연결_문자열
ANALYTICS_ADMIN_USERNAME=관리자_아이디
ANALYTICS_ADMIN_PASSWORD=긴_관리자_비밀번호
CRON_SECRET=16자_이상_난수
```

```bash
pnpm analytics:schema
```

`/admin/analytics`는 HTTP Basic 인증으로 보호되며 최근 7일, 최근 30일, 이번 달, 최대 1년의
사용자 지정 기간 집계와 공고별·단지별 순위를 표시합니다. Neon 콘솔에서 직접 추출할 SQL은
[`database/analytics-queries.sql`](database/analytics-queries.sql)에 있습니다. Vercel Cron은 매일
한국 시간 자정 무렵 1년이 지난 일별 카운터를 삭제합니다.

## 구조

- `src/app`: 라우트와 의존성 조립
- `src/domain/public-rental`: 공공임대 타입과 배포 규칙
- `src/domain/announcement-analytics`: 비식별 일별 카운터와 대시보드 집계 규칙
- `src/features/map`: 필터, 목록, 상세, 지도 사용자 흐름
- `src/infrastructure/kakao`: Kakao SDK·클러스터·마커 컨트롤러
- `src/infrastructure/public-data`: CSV 파서·정규화·스냅샷
- `src/infrastructure/analytics`: Neon 카운터 저장소·관리자 인증
- `src/infrastructure/public-rental-csv`: 파일 탐색·좌표·수집 보고서
- `scripts`: CSV 기본 수집기와 API 검수 수집기
- `tests/e2e`: 주요 브라우저 사용자 흐름

`.env.local`과 실제 키는 커밋하지 않습니다. 데모 직전 `pnpm
collect:public-rentals`를 다시 실행하고 생성물 diff와 보고서 경고만 검수하는 흐름을
권장합니다.
