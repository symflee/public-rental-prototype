import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "경기도 LH 임대주택 지도",
  description: "경기도 LH 공공임대주택과 모집공고를 탐색하는 지도",
};

type RootLayoutProperties = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="ko">
      <body>
        {children}
        <footer className="fixed bottom-3 right-3 z-50 rounded-full bg-white/95 px-3 py-1.5 text-xs shadow-sm ring-1 ring-slate-200">
          <a className="font-medium text-slate-700 underline underline-offset-2" href="/privacy">
            개인정보처리방침
          </a>
        </footer>
      </body>
    </html>
  );
}
