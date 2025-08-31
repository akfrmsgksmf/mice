import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "MICE 예약 시스템",
  description: "공간 대여 예약 시스템 (mice)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
