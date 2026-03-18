"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button, Grid, GridItem } from "@wanteddev/wds";

export function GNB() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname.startsWith("/survey/")) return null;

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ backgroundColor: "rgba(var(--background), 0.95)" }}>
      <Grid spacing={0} sx={{ paddingLeft: "16px", paddingRight: "16px" }}>
      <GridItem columns={12} md={{ columns: 10, offset: 1 }} lg={{ columns: 8, offset: 2 }}>
      <div className="flex h-12 items-center">
        <Link href="/">
          <img src="/logo.svg" alt="홈" className="h-7 w-7" />
        </Link>
        <nav className="ml-4 flex items-center gap-1">
          {status !== "loading" && !session?.user ? (
            <Button
              variant="outlined"
              color="assistive"
              size="small"
              sx={{ border: "none", boxShadow: "none" }}
              onClick={() => signIn("google", { callbackUrl: "/admin" })}
            >
              설문 생성
            </Button>
          ) : (
            <Button
              as={Link}
              href="/admin"
              variant="outlined"
              color="assistive"
              size="small"
              sx={(theme) => ({
                border: "none",
                boxShadow: "none",
                color:
                  pathname === "/admin"
                    ? theme.semantic.label.normal
                    : theme.semantic.label.alternative,
              })}
            >
              설문 생성
            </Button>
          )}
          <Button
            as={Link}
            href="/dashboards"
            variant="outlined"
            color="assistive"
            size="small"
            sx={(theme) => ({
              border: "none",
              boxShadow: "none",
              color:
                pathname === "/dashboards"
                  ? theme.semantic.label.normal
                  : theme.semantic.label.alternative,
            })}
          >
            대시보드
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {status === "loading" ? null : session?.user ? (
            <button
              onClick={() => signOut()}
              className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
              title={session.user.name || "로그아웃"}
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt="프로필"
                  className="size-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {session.user.name?.charAt(0) || "?"}
                </div>
              )}
            </button>
          ) : (
            <Button
              variant="outlined"
              color="assistive"
              size="small"
              sx={{ border: "none", boxShadow: "none" }}
              onClick={() => signIn("google", { callbackUrl: "/dashboards" })}
            >
              로그인
            </Button>
          )}
        </div>
      </div>
      </GridItem>
      </Grid>
    </header>
  );
}
