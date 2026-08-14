import type { ReactNode } from "react";

export const metadata = {
  title: "개인정보처리방침 | 경기도 LH 임대주택 지도",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-7 p-6 pb-16 md:p-10">
      <header>
        <h1 className="text-2xl font-bold text-slate-950">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-slate-600">시행일: 2026년 8월 14일</p>
      </header>
      <AnalyticsPolicy />
      <BookmarkPolicy />
      <RetentionPolicy />
      <ExternalServicePolicy />
    </main>
  );
}

function AnalyticsPolicy() {
  return (
    <>
      <PolicySection heading="분석 정보 수집">
        서비스는 전체 임대주택 탐색 기능의 수요를 확인하기 위해 30일 동안 유지되는 무작위 익명
        브라우저 식별 쿠키를 사용합니다. 자체 분석 DB에는 쿠키 원문 대신 서버 비밀키로 만든 해시만
        저장하며, 계정, IP 주소, User-Agent와 브라우저 지문은 저장하지 않습니다.
      </PolicySection>
      <PolicySection heading="수집 목적과 항목">
        서비스 이용 현황과 비모집 주택 탐색 수요를 파악하기 위해 지도 이용, 현재 연결된 모집공고가
        없는 주택의 상세 확인, 관심 주택 저장·해제와 모집공고 열람 행동을 기록합니다. 실험 버전,
        이벤트 시각, 공개 주택의 위치 ID와 당시 모집 상태도 함께 저장합니다.
      </PolicySection>
    </>
  );
}

function BookmarkPolicy() {
  return (
    <PolicySection heading="관심 주택 저장">
      관심 주택은 현재 브라우저의 로컬 저장소에만 보관됩니다. 계정이나 다른 기기와 동기화되지 않으며
      브라우저 데이터를 삭제하면 함께 삭제됩니다. 모집공고 알림은 아직 제공하지 않습니다.
    </PolicySection>
  );
}

function RetentionPolicy() {
  return (
    <PolicySection heading="보관 기간">
      익명 브라우저별 실험 행동은 90일 후 삭제하고 일별 합산 카운터는 1년 후 삭제합니다. 쿠키를
      삭제하거나 여러 브라우저와 기기를 사용하면 서로 다른 방문자로 집계될 수 있습니다.
    </PolicySection>
  );
}

function ExternalServicePolicy() {
  return (
    <PolicySection heading="외부 서비스와 문의">
      서비스는 Vercel과 Neon을 이용해 제공됩니다. 각 서비스의 접속 로그 처리와 관련한 사항은 해당
      제공자의 정책이 적용될 수 있습니다. 개인정보 관련 문의는 운영자에게 연락해 주세요. 이 방침은
      <a
        className="ml-1 font-medium text-blue-700 underline underline-offset-2"
        href="https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=10125"
        rel="noreferrer"
        target="_blank"
      >
        개인정보위 개인정보 처리방침 작성지침
      </a>
      을 참고해 첫 화면에서 접근할 수 있도록 제공합니다.
    </PolicySection>
  );
}

function PolicySection({ children, heading }: Readonly<{ children: ReactNode; heading: string }>) {
  return (
    <section>
      <h2 className="font-bold text-slate-950">{heading}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{children}</p>
    </section>
  );
}
