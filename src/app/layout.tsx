import type { Metadata } from "next";
import "./globals.css";
import { GNB } from "@/components/gnb";

export const metadata: Metadata = {
  title: "MaxDiff 설문조사",
  description: "MaxDiff 설문조사 및 분석 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-background min-h-screen">
        <GNB />
        {children}
      </body>
    </html>
  );
}
