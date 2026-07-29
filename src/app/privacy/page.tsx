export const metadata = {
  title: "개인정보처리방침 | 경기도 LH 임대주택 지도",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-7 p-6 pb-16 md:p-10">
      <header>
        <h1 className="text-2xl font-bold text-slate-950">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-slate-600">시행일: 2026년 7월 29일</p>
      </header>
      <PolicySection heading="분석 정보 수집">
        이 서비스의 자체 분석 DB는 방문자 쿠키, 계정, IP 주소, User-Agent, 브라우저 지문과 개인별
        행동 기록을 저장하지 않습니다.
      </PolicySection>
      <PolicySection heading="수집 목적과 항목">
        서비스 이용 현황과 공고 확인 수요를 파악하기 위해 한국 시간 기준 날짜, 지도 조회 횟수, 실제
        공고 열람 클릭 횟수, 미연결 단지의 공고 확인 의향 클릭 횟수만 합산합니다. 공고 ID와 단지
        ID는 공개 주택 데이터의 식별자이며 이용자를 식별하는 정보가 아닙니다.
      </PolicySection>
      <PolicySection heading="보관 기간">
        일별 합산 카운터는 1년 보관 후 삭제합니다. 새로고침, 반복 클릭, 자동화 요청도 횟수에 포함될
        수 있습니다.
      </PolicySection>
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
    </main>
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
import type { ReactNode } from "react";
