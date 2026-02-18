"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
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
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-[60px] pb-12">
      <div className="flex items-center justify-between pb-5 mb-5 border-b border-border">
        <h1 className="text-3xl font-bold text-foreground">대시보드</h1>
        <Link href="/admin" className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 gap-1")}>
          <Plus className="size-4" />설문 추가
        </Link>
      </div>

      {surveys.length === 0 ? (
        <p className="text-sm text-muted-foreground">생성된 설문이 없습니다.</p>
      ) : (
        <div className="-mx-4">
          {surveys.map((s) => {
            const itemCount = JSON.parse(s.items).length;
            const hasResponses = Number(s.responseCount) > 0;
            const isDraft = s.status === "draft";
            return (
              <Card key={s.id} className="border-0 shadow-none ring-0 hover:bg-muted/50 transition-colors rounded-lg px-4 py-3 cursor-pointer" onClick={() => router.push(`/dashboard/${s.id}`)}>
                <CardContent className="flex items-center justify-between h-full px-0 py-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground text-[15px] truncate">{s.title}</p>
                      {isDraft && (
                        <Badge variant="secondary" className="shrink-0 h-5 border-0 text-[11px]">
                          draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      항목 {itemCount}개 · 응답 {Number(s.responseCount)}건 · {s.createdAt.slice(0, 10).replace(/-/g, ".")}
                    </p>
                  </div>
                  <div className="flex items-center shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8 text-muted-foreground hover:text-destructive")}
                        title="삭제"
                        onClick={async () => {
                          if (!confirm("정말 이 설문을 삭제하시겠습니까?")) return;
                          const res = await fetch(`/api/surveys/${s.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setSurveys(surveys.filter((sv) => sv.id !== s.id));
                          } else {
                            const data = await res.json();
                            alert(data.error || "삭제에 실패했습니다.");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                      {hasResponses ? (
                        <span
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8 opacity-50 cursor-not-allowed")}
                          title="응답이 있는 설문은 수정할 수 없습니다"
                        >
                          <Pencil className="size-4" />
                        </span>
                      ) : (
                        <Link href={`/admin/${s.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8")} title="수정">
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      <Link href={`/survey/${s.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8")} title="미리보기">
                        <Eye className="size-4" />
                      </Link>
                    </div>
                    <div className="ml-2">
                      <Link href={`/dashboard/${s.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}>
                        응답보기
                      </Link>
                    </div>
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
