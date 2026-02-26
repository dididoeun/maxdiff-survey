"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Survey {
  id: string;
  title: string;
  items: string;
  setSize: number;
  createdAt: string;
}

export default function Home() {
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-[60px] pb-12 text-center">
      <h1 className="text-[40px] font-bold text-foreground mb-2">
        원티드 UX 리서치
      </h1>
      <p className="text-muted-foreground">
        UX 리서치를 위한 설문조사를 만들고 결과를 분석하세요.
      </p>

      <Link href="/admin" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-[32px] mb-[48px] h-10 px-3.5")}>
        + 새 설문 만들기
      </Link>

      {surveys.length > 0 && (
        <div>
          <div className="space-y-3">
            {surveys.map((s) => {
              const itemCount = JSON.parse(s.items).length;
              return (
                <Card key={s.id} className="h-20">
                  <CardContent className="flex items-center justify-between h-full px-6 py-0">
                    <div className="text-left">
                      <p className="font-medium text-foreground text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        항목 {itemCount}개 · {s.createdAt}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/survey/${s.id}`} className={cn(buttonVariants({ variant: "secondary" }), "size-8")} title="미리보기">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                      </Link>
                      <Link href={`/dashboard/${s.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8")}>
                        대시보드
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
