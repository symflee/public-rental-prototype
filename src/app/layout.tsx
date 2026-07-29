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
      <body>{children}</body>
    </html>
  );
}
