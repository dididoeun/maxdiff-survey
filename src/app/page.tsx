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
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">
        자급자족 컴포넌트 개선 시급도 조사툴
      </h1>
      <p className="text-muted-foreground">
        MaxDiff 조사를 만들고 결과를 분석할 수 있어요.
      </p>

      <Link href="/admin" className={cn(buttonVariants({ size: "lg" }), "mt-6 mb-10 h-10 px-3.5")}>
        + 새 설문 만들기
      </Link>

      {surveys.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">
            생성된 설문
          </h2>
          <div className="space-y-3">
            {surveys.map((s) => {
              const itemCount = JSON.parse(s.items).length;
              return (
                <Card key={s.id} className="h-20">
                  <CardContent className="flex items-center justify-between h-full px-6 py-0">
                    <div>
                      <p className="font-medium text-foreground text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        항목 {itemCount}개 · {s.createdAt}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/survey/${s.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8")}>
                        설문
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
