import type { Metadata } from "next";
import "./globals.css";
import { GNB } from "@/components/gnb";
import { AuthSessionProvider } from "@/components/session-provider";
import { WDSProvider } from "@/components/wds-provider";

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body>
        <WDSProvider>
          <AuthSessionProvider>
            <GNB />
            {children}
          </AuthSessionProvider>
        </WDSProvider>
      </body>
    </html>
  );
}
