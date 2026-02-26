"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GNB() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-3xl mx-auto flex h-12 items-center px-4">
        <Link href="/">
          <img src="/book.svg" alt="홈" className="h-5 w-5" />
        </Link>
        <nav className="ml-4 flex items-center gap-1">
          {status !== "loading" && !session?.user ? (
            <button
              onClick={() => signIn("google", { callbackUrl: "/admin" })}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-muted-foreground"
              )}
            >
              설문 생성
            </button>
          ) : (
            <Link
              href="/admin"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                pathname === "/admin" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              설문 생성
            </Link>
          )}
          <Link
            href="/dashboards"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              pathname === "/dashboards" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            대시보드
          </Link>
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
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboards" })}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-muted-foreground"
              )}
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
