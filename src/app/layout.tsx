import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "공공임대 지도 프로토타입",
  description: "공공임대 주택 위치 탐색 서비스 프로토타입",
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
