"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GNB() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-3xl mx-auto flex h-12 items-center px-4">
        <Link href="/">
          <img src="/book.svg" alt="홈" className="h-5 w-5" />
        </Link>
        <nav className="ml-4 flex items-center gap-1">
          <Link
            href="/admin"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              pathname === "/admin" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            설문 생성
          </Link>
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
      </div>
    </header>
  );
}
