"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SurveyItem {
  name: string;
  image?: string;
}

interface Survey {
  id: string;
  title: string;
  items: SurveyItem[];
  setSize: number;
  jobRoles: string[];
}

export default function SurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [sets, setSets] = useState<SurveyItem[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [best, setBest] = useState<string | null>(null);
  const [worst, setWorst] = useState<string | null>(null);
  const [respondentId, setRespondentId] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const generateSets = useCallback(
    (items: SurveyItem[], setSize: number): SurveyItem[][] => {
      const n = items.length;
      if (n <= setSize) return [items];

      const minExposure = 3;
      const totalSets = Math.ceil((n * minExposure) / setSize);
      const result: SurveyItem[][] = [];
      const exposureCount = new Map<string, number>();
      items.forEach((item) => exposureCount.set(item.name, 0));

      for (let i = 0; i < totalSets; i++) {
        const sorted = [...items].sort((a, b) => {
          const ca = exposureCount.get(a.name) || 0;
          const cb = exposureCount.get(b.name) || 0;
          if (ca !== cb) return ca - cb;
          return Math.random() - 0.5;
        });
        const set = sorted.slice(0, setSize);
        result.push(set);
        set.forEach((item) => {
          exposureCount.set(
            item.name,
            (exposureCount.get(item.name) || 0) + 1
          );
        });
      }

      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
    []
  );

  useEffect(() => {
    setRespondentId(crypto.randomUUID());
    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSurvey(data);
        setSets(generateSets(data.items, data.setSize));
      })
      .catch(() => setError("설문을 불러올 수 없습니다."));
  }, [surveyId, generateSets]);

  const handleSelect = (itemName: string, type: "best" | "worst") => {
    if (type === "best") {
      if (worst === itemName) setWorst(null);
      setBest(itemName);
    } else {
      if (best === itemName) setBest(null);
      setWorst(itemName);
    }
  };

  const submitRound = async () => {
    if (!best || !worst) return;
    setSubmitting(true);

    const currentSet = sets[currentRound];
    await fetch(`/api/surveys/${surveyId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respondentId,
        jobRole,
        round: currentRound,
        setBatch: currentSet.map((i) => i.name),
        bestItem: best,
        worstItem: worst,
      }),
    });

    if (currentRound + 1 >= sets.length) {
      setCompleted(true);
    } else {
      setCurrentRound(currentRound + 1);
      setBest(null);
      setWorst(null);
    }
    setSubmitting(false);
  };

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!survey || sets.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">설문을 불러오는 중...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <Card className="py-6">
          <CardHeader className="px-6">
            <div className="text-5xl mb-2">🎉</div>
            <CardTitle className="text-2xl">설문이 완료되었습니다!</CardTitle>
            <CardDescription>참여해 주셔서 감사합니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 직군 선택 화면 (직군 항목이 있는 경우에만)
  if (!started && survey.jobRoles.length > 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <Card className="py-6">
          <CardHeader className="px-6">
            <CardTitle className="text-2xl">{survey.title}</CardTitle>
            <CardDescription>
              설문을 시작하기 전에 직군을 선택해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6">
            <div className="space-y-2">
              {survey.jobRoles.map((role) => (
                <Button
                  key={role}
                  variant="outline"
                  className={`w-full justify-start font-medium h-10 px-3.5 ${
                    jobRole === role
                      ? "border-primary bg-accent"
                      : ""
                  }`}
                  onClick={() => setJobRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>

            <Button
              onClick={() => setStarted(true)}
              disabled={!jobRole}
              className="w-full h-10 px-3.5"
              size="lg"
            >
              설문 시작하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSet = sets[currentRound];
  const progressValue = ((currentRound + 1) / sets.length) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground mb-1">
          {survey.title}
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {currentRound + 1} / {sets.length} 라운드
          </p>
          <Progress value={progressValue} className="flex-1" />
        </div>
      </div>

      <Card className="mb-6 py-6">
        <CardContent className="px-6">
          <p className="text-center text-muted-foreground mb-4 text-sm">
            <span className="text-red-600 font-semibold">가장 시급한 것</span>{" "}
            1개와{" "}
            <span className="text-green-600 font-semibold">
              가장 덜 시급한 것
            </span>{" "}
            1개를 선택하세요.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentSet.map((item) => {
              const isBest = best === item.name;
              const isWorst = worst === item.name;

              return (
                <div
                  key={item.name}
                  className="border rounded-xl p-4 transition border-border bg-card"
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-32 object-contain rounded-lg mb-3 bg-muted"
                    />
                  )}
                  <p className="font-medium text-foreground text-center mb-3">
                    {item.name}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-1 h-10 px-3.5 ${
                        isBest
                          ? "border-red-500 bg-red-50 text-red-600 hover:bg-red-100"
                          : ""
                      }`}
                      onClick={() => handleSelect(item.name, "best")}
                    >
                      🔺 가장 시급
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-1 h-10 px-3.5 ${
                        isWorst
                          ? "border-green-500 bg-green-50 text-green-600 hover:bg-green-100"
                          : ""
                      }`}
                      onClick={() => handleSelect(item.name, "worst")}
                    >
                      🔻 가장 덜 시급
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={submitRound}
        disabled={!best || !worst || submitting}
        className="w-full h-10 px-3.5"
        size="lg"
      >
        {submitting
          ? "제출 중..."
          : currentRound + 1 < sets.length
          ? "다음 라운드"
          : "설문 완료"}
      </Button>
    </div>
  );
}
