"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

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
  status?: string;
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
        if (data.status === "draft") {
          setError("아직 발행되지 않은 설문입니다.");
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
      <div className="max-w-lg mx-auto px-4 py-12 flex items-center justify-center gap-2">
        <Spinner />
        <p className="text-muted-foreground">설문을 불러오는 중...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <img src="/success.svg" alt="" className="mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-foreground">설문을 제출했어요!</h2>
        <p className="text-muted-foreground mt-1">소중한 시간내어 참여해 주셔서 감사합니다.</p>
      </div>
    );
  }

  // 직군 선택 화면 (직군 항목이 있는 경우에만)
  if (!started && survey.jobRoles.length > 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold text-foreground">{survey.title}</h2>
        <p className="text-muted-foreground mt-1 mb-6">
          설문을 시작하기 전에 직군을 선택해주세요.
        </p>

        <div className="space-y-2 mb-6" role="radiogroup">
          {survey.jobRoles.map((role) => (
            <label
              key={role}
              className="cn-field group/field flex w-full cn-field-orientation-horizontal flex-row items-center cursor-pointer rounded-lg border border-border px-3.5 h-10 hover:bg-muted transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="jobRole"
                value={role}
                checked={jobRole === role}
                onChange={() => setJobRole(role)}
                className="size-4 accent-primary shrink-0"
              />
              <span className="ml-3 text-sm font-medium text-foreground flex-auto">{role}</span>
            </label>
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

      <div className="mb-6">
        <p className="text-muted-foreground mb-5 text-sm">
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
                className="border rounded-xl p-4 transition border-border bg-card flex flex-col"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-32 object-cover rounded-lg mb-3 bg-muted"
                  />
                )}
                <p className="font-medium text-foreground text-center mb-3 flex-1">
                  {item.name}
                </p>
                <div className="flex gap-2 mt-auto">
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M7.5 8 10 9"/><path d="m14 9 2.5-1"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg> 가장 시급
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg> 가장 덜 시급
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
