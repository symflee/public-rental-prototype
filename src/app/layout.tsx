import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "성남·용인 LH 임대주택 지도",
  description: "성남시와 용인시의 LH 임대주택 269곳을 탐색하는 지도",
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
