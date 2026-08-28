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
- 브라우저에 보관되는 관심 주택과 저장한 주택만 보기
- 모집공고 연결 상태별 주택 상세 조회 건수 분석
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
| `pnpm analytics:schema`                | Neon 분석 테이블·제약 준비             |
| `pnpm analytics:seed-history`          | 8월 11~14일 재구성 조회 기록 적재      |
| `pnpm analytics:clear-history`         | 재구성 조회 기록만 제거                |
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

## 서비스 이용 분석

관리자 대시보드는 한국 시간 기준 일별 행동 횟수를 합산합니다.

- 지도 조회수
- 전체 주택 정보 조회수
- 현재 연결된 모집공고가 없는 주택 정보 조회수와 전체 조회 대비 비율
- 실제 공고 열람 클릭 수
- 미연결 단지의 공고 확인 의향 클릭 수

주택 상세 조회는 서버가 현재 스냅샷과 수기 연결 공고의 모집 기간을 확인한 뒤 조회 시각, 위치 ID,
당시 모집 상태와 판정 출처를 별도 이벤트로 저장합니다. 같은 주택을 닫았다 다시 열거나 A→B→A로
이동한 행동은 각각 새 조회로 기록하며 단순 재렌더는 중복 기록하지 않습니다. 방문자 식별자, IP,
User-Agent와 브라우저 지문은 저장하지 않습니다.

관심 주택 기능의 기존 행동 분석은 30일 first-party HttpOnly 쿠키로 같은 익명 브라우저를 구분합니다.
DB에는 쿠키 원문이 아닌 서버 HMAC 해시만 저장하며 IP 주소, User-Agent와 브라우저 지문은
저장하지 않습니다. 지도 준비, 현재 연결된 모집공고가 없는 주택 상세 확인, 북마크 추가·해제와
모집공고 열람을 중복 제거해 집계합니다. 쿠키 삭제와 여러 브라우저·기기는 서로 다른 방문자로
계산됩니다. 첫 이벤트는 쿠키만 발급한 뒤 같은 이벤트를 한 번 재시도하므로, 쿠키를 유지하지 않는
단순 반복 요청이 고유 방문자로 바로 집계되지 않습니다. 일시적인 저장 실패도 클라이언트가 한 번
재시도하고 서버는 실패 상태를 반환합니다.

관심 주택 자체는 계정이나 서버가 아닌 해당 브라우저의 로컬 저장소에 최대 100곳까지 보관됩니다.
브라우저 데이터를 삭제하면 함께 삭제되며 모집공고 알림은 아직 제공하지 않습니다.

Vercel Marketplace에서 Neon을 연결한 뒤 연결 문자열과 아래 서버 전용 환경 변수를 설정하고
스키마를 한 번 준비합니다.

```dotenv
DATABASE_URL=Neon_연결_문자열
ANALYTICS_ADMIN_USERNAME=관리자_아이디
ANALYTICS_ADMIN_PASSWORD=긴_관리자_비밀번호
ANALYTICS_MIGRATION_TOKEN=배포_작업_중에만_사용할_32바이트_이상_난수
CRON_SECRET=16자_이상_난수
ANALYTICS_VISITOR_HASH_SECRET=32자_이상의_서버_비밀값
```

```bash
pnpm analytics:schema
```

Vercel의 Sensitive 환경 변수는 로컬 CLI로 내려받을 수 없으므로, 로컬에 Neon 연결 문자열을
두지 않는 경우에는 Neon SQL Editor에서
[`database/analytics-schema.sql`](database/analytics-schema.sql)을 한 번 실행합니다. 이 파일은
일별 서비스 지표, 개별 주택 조회 기록, 분석 실행 이력과 수기 모집공고 테이블을 모두 준비합니다.
배포 환경에서 직접 준비할 때는 임시 `ANALYTICS_MIGRATION_TOKEN`을 설정한 배포에
`POST /api/operations/analytics-history`를 Bearer 인증으로 한 번 호출합니다. 응답의
`132/52/39.4`를 확인한 뒤 토큰을 제거하면 이 작업 API는 다시 사용할 수 없습니다.

`/admin/analytics`는 HTTP Basic 인증으로 보호됩니다. 운영 데이터 화면은
`/admin/analytics?period=7d`, 8월 11~14일 기록은 `/admin/analytics?dataset=history`, 주택별 내역은
`/admin/analytics/runs/2026-08-11-14`에서 확인합니다. 지도·주택 상세·공고 확인 행동 횟수와 현재
모집 중이 아닌 주택 상세 조회 비율을 표시하며 북마크 관련 지표와 가설 판정은 표시하지 않습니다.
Neon
콘솔에서 직접 추출할 SQL은 [`database/analytics-queries.sql`](database/analytics-queries.sql)에
있습니다. Vercel Cron은 매일 한국 시간 자정 무렵 90일이 지난 익명 실험 이벤트와 1년이 지난
일별 카운터를 삭제합니다.

수기 모집공고는 `/admin/recruitment-notices`에서 공식 LH 공고 URL, 공고일, 모집 시작·종료 시각과
연결할 주택 ID를 입력합니다. 이 데이터는 정적 스냅샷을 덮어쓰지 않고 지도 API 응답에 합쳐지며,
기간 전에는 `모집 예정 · 수기 연결`, 기간 안에는 `현재 모집 중 · 수기 연결`, 기간이 지나면
`지난 공고 · 수기 연결`로 표시됩니다.

제출된 관측값은 2026년 8월 11~14일의 전체 조회 132건, 비모집 조회 52건(39.4%)입니다. 원시
로그가 남아 있지 않아 개별 시각과 주택별 횟수는 제출 합계, 공식 공고 기간과 당시 수기 연결
대상을 제약으로 삼아 결정적으로 재구성합니다. 따라서 화면과 DB에는 `재구성 데이터`로 명시하며
실제 원시 로그라고 표현하지 않습니다. 적재 명령은 같은 데이터셋을 한 SQL 문에서 교체한 뒤
동결하므로 다시 실행해도 132건보다 늘어나지 않습니다.

```bash
pnpm analytics:seed-history
pnpm analytics:clear-history
```

실제 운영 조회는 `live`, 재구성 기록은 `historical-2026-08-11-14-v1` 데이터셋으로 분리됩니다.
현재 상태는 조회 순간의 모집 기간으로 판정합니다. 검증된 스냅샷이 72시간을 넘겼거나 일부 수집
상태이면 공고 부재를 확정하지 않고 해당 조회의 계측을 중단합니다. 다만 기간까지 검토해 저장한
수기 공고가 있는 주택은 해당 근거를 `MANUAL_REVIEW`로 남기고 종료·예정 상태의 비모집 조회를
계측합니다. 수기 공고 DB를 읽지 못한 경우에도 비모집으로 대체하지 않고 지도 API와 계측 요청이
실패하도록 해 지표 오염을 막습니다.
운영 스냅샷 갱신은 아래 명령을 사용합니다.

```bash
pnpm collect:public-rentals:gyeonggi
```

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
