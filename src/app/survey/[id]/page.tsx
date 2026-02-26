"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

interface SurveyItem {
  name: string;
  image?: string;
}

interface Question {
  id: string;
  type: "multiple_choice" | "short_answer" | "long_answer" | "section";
  title: string;
  options: string[];
  required: boolean;
  questionOrder: number;
}

interface SectionGroup {
  sectionTitle: string | null;
  questions: Question[];
}

function groupBySections(questions: Question[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let currentTitle: string | null = null;
  let currentQuestions: Question[] = [];

  for (const q of questions) {
    if (q.type === "section") {
      if (currentQuestions.length > 0) {
        groups.push({ sectionTitle: currentTitle, questions: currentQuestions });
      }
      currentTitle = q.title || null;
      currentQuestions = [];
    } else {
      currentQuestions.push(q);
    }
  }
  if (currentQuestions.length > 0 || groups.length === 0) {
    groups.push({ sectionTitle: currentTitle, questions: currentQuestions });
  }
  return groups;
}

interface Survey {
  id: string;
  title: string;
  items: SurveyItem[];
  setSize: number;
  jobRoles: string[];
  status?: string;
  questions: Question[];
}

type Stage = "job" | "general" | "maxdiff";

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
  const [stage, setStage] = useState<Stage>("job");
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 일반 문항 응답
  const [generalAnswers, setGeneralAnswers] = useState<
    { questionId: string; answer: string | string[] }[]
  >([]);
  const [generalError, setGeneralError] = useState("");
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);

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
    const id = crypto.randomUUID();
    setRespondentId(id);
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
        // 일반 문항 초기 응답값 세팅
        if (data.questions?.length > 0) {
          setGeneralAnswers(
            data.questions.map((q: Question) => ({
              questionId: q.id,
              answer: q.type === "multiple_choice" ? [] : "",
            }))
          );
        }
        // 직군 없으면 바로 general 또는 maxdiff 단계로
        if (!data.jobRoles || data.jobRoles.length === 0) {
          if (data.questions?.length > 0) {
            setStage("general");
          } else {
            setStage("maxdiff");
          }
        }
      })
      .catch(() => setError("설문을 불러올 수 없습니다."));
  }, [surveyId, generateSets]);

  const handleGeneralAnswer = (
    questionId: string,
    value: string | string[]
  ) => {
    setGeneralAnswers((prev) =>
      prev.map((a) => (a.questionId === questionId ? { ...a, answer: value } : a))
    );
  };

  const submitGeneralAnswers = async () => {
    if (!survey) return;
    // 필수 문항 검증
    for (const q of survey.questions) {
      if (!q.required) continue;
      const ans = generalAnswers.find((a) => a.questionId === q.id);
      if (!ans) continue;
      const isEmpty =
        Array.isArray(ans.answer)
          ? ans.answer.length === 0
          : String(ans.answer).trim() === "";
      if (isEmpty) {
        setGeneralError(`"${q.title || "문항"}"은 필수 입력입니다.`);
        return;
      }
    }
    setGeneralError("");
    setSubmitting(true);
    try {
      await fetch(`/api/surveys/${surveyId}/general-responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respondentId, answers: generalAnswers }),
      });
    } catch {
      // 저장 실패해도 진행
    }
    setSubmitting(false);
    setStage("maxdiff");
  };

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

  // 직군 선택 화면
  if (stage === "job" && survey.jobRoles.length > 0) {
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
          onClick={() => {
            if (survey.questions?.length > 0) {
              setStage("general");
            } else {
              setStage("maxdiff");
            }
          }}
          disabled={!jobRole}
          className="w-full h-10 px-3.5"
          size="lg"
        >
          설문 시작하기
        </Button>
      </div>
    );
  }

  // 일반 문항 응답 화면 (섹션별)
  if (stage === "general" && survey.questions?.length > 0) {
    const sections = groupBySections(survey.questions);
    const section = sections[currentSectionIdx];
    const isLastSection = currentSectionIdx === sections.length - 1;

    const handleNextSection = async () => {
      // 현재 섹션 필수 문항 검증
      for (const q of section.questions) {
        if (!q.required) continue;
        const ans = generalAnswers.find((a) => a.questionId === q.id);
        const isEmpty = !ans || (Array.isArray(ans.answer) ? ans.answer.length === 0 : String(ans.answer).trim() === "");
        if (isEmpty) {
          setGeneralError(`"${q.title || "문항"}"은 필수 입력입니다.`);
          return;
        }
      }
      setGeneralError("");

      if (!isLastSection) {
        setCurrentSectionIdx((i) => i + 1);
        return;
      }
      await submitGeneralAnswers();
    };

    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-foreground mb-1">{survey.title}</h2>
        {section.sectionTitle && (
          <p className="text-base font-semibold text-foreground mt-4 mb-1">{section.sectionTitle}</p>
        )}
        {sections.length > 1 && (
          <p className="text-xs text-muted-foreground mb-6">
            {currentSectionIdx + 1} / {sections.length}
          </p>
        )}
        {!section.sectionTitle && sections.length <= 1 && (
          <p className="text-sm text-muted-foreground mb-6">사전 질문에 답해주세요.</p>
        )}

        <div className="space-y-8">
          {section.questions.map((q) => {
            const ans = generalAnswers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {q.title}
                  {q.required && <span className="text-red-500 ml-0.5">*</span>}
                </p>

                {q.type === "multiple_choice" && (
                  <div className="space-y-2">
                    {q.options.map((opt, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-2 cursor-pointer rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={Array.isArray(ans?.answer) ? ans.answer.includes(opt) : ans?.answer === opt}
                          onChange={() => handleGeneralAnswer(q.id, opt)}
                          className="size-4 accent-primary shrink-0"
                        />
                        <span className="text-sm text-foreground">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "short_answer" && (
                  <input
                    type="text"
                    value={typeof ans?.answer === "string" ? ans.answer : ""}
                    onChange={(e) => handleGeneralAnswer(q.id, e.target.value)}
                    placeholder="답변을 입력하세요"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}

                {q.type === "long_answer" && (
                  <textarea
                    value={typeof ans?.answer === "string" ? ans.answer : ""}
                    onChange={(e) => handleGeneralAnswer(q.id, e.target.value)}
                    placeholder="답변을 입력하세요"
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        {generalError && <p className="mt-3 text-sm text-red-500">{generalError}</p>}

        <div className="flex gap-2 mt-6">
          {currentSectionIdx > 0 && (
            <Button
              variant="outline"
              onClick={() => { setGeneralError(""); setCurrentSectionIdx((i) => i - 1); }}
              className="h-10"
              size="lg"
            >
              이전
            </Button>
          )}
          <Button
            onClick={handleNextSection}
            disabled={submitting}
            className="flex-1 h-10"
            size="lg"
          >
            {submitting ? "저장 중..." : isLastSection ? "다음" : "다음"}
          </Button>
        </div>
      </div>
    );
  }

  // MaxDiff 라운드 화면
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
