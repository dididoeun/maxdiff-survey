"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Survey {
  id: string;
  title: string;
  items: string;
  setSize: number;
  status: string;
  responseCount: number;
  createdAt: string;
}

export default function DashboardsPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-[60px] pb-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">대시보드</h1>
      <p className="text-muted-foreground mb-8">
        생성된 설문의 결과를 확인하고 분석할 수 있어요.
      </p>

      {surveys.length === 0 ? (
        <p className="text-sm text-muted-foreground">생성된 설문이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {surveys.map((s) => {
            const itemCount = JSON.parse(s.items).length;
            const hasResponses = Number(s.responseCount) > 0;
            const isDraft = s.status === "draft";
            return (
              <Card key={s.id} className="h-20">
                <CardContent className="flex items-center justify-between h-full px-6 py-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground text-[15px] truncate">{s.title}</p>
                      {isDraft && (
                        <Badge variant="secondary" className="text-amber-600 bg-amber-600/10 shrink-0 h-5 border-0 text-[11px]">
                          임시저장
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      항목 {itemCount}개 · 응답 {Number(s.responseCount)}건 · {s.createdAt}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-4">
                    {hasResponses ? (
                      <span
                        className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-8 opacity-50 cursor-not-allowed")}
                        title="응답이 있는 설문은 수정할 수 없습니다"
                      >
                        <Pencil className="size-4" />
                      </span>
                    ) : (
                      <Link href={`/admin/${s.id}`} className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-8")} title="수정">
                        <Pencil className="size-4" />
                      </Link>
                    )}
                    <Link href={`/survey/${s.id}`} className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-8")} title="미리보기">
                      <Eye className="size-4" />
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
      )}
    </div>
  );
}
