"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        MaxDiff 설문조사
      </h1>
      <p className="text-muted-foreground mb-8">
        설문을 생성하고, 응답을 수집하고, 결과를 분석하세요.
      </p>

      <Button asChild size="lg" className="mb-10">
        <Link href="/admin">+ 새 설문 만들기</Link>
      </Button>

      {surveys.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">
            생성된 설문
          </h2>
          <div className="space-y-3">
            {surveys.map((s) => {
              const itemCount = JSON.parse(s.items).length;
              return (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        항목 {itemCount}개 · {s.createdAt}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/survey/${s.id}`}>설문</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/${s.id}`}>대시보드</Link>
                      </Button>
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
