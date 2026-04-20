"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Box, Button, ContentBadge, FlexBox, Loading, TextArea, TextField, Typography } from "@wanteddev/wds";
import { PageContent } from "@/components/page-content";

interface SurveyItem {
  name: string;
  image?: string;
}

interface Question {
  id: string;
  type: "multiple_choice" | "short_answer" | "long_answer" | "section" | "maxdiff";
  title: string;
  options: string[] | SurveyItem[];
  required: boolean;
  multipleAnswers?: boolean;
  questionOrder: number;
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  items: SurveyItem[];
  setSize: number;
  jobRoles: string[];
  status?: string;
  questions: Question[];
  maxdiffTitle?: string;
  bestLabel?: string;
  worstLabel?: string;
}

type SurveyStep =
  | { kind: "general"; sectionTitle: string | null; questions: Question[] }
  | { kind: "maxdiff"; question: Question };

function buildSteps(survey: Survey): SurveyStep[] {
  const steps: SurveyStep[] = [];
  let currentTitle: string | null = null;
  let currentQuestions: Question[] = [];

  const pushGeneral = () => {
    if (currentQuestions.length > 0) {
      steps.push({
        kind: "general",
        sectionTitle: currentTitle,
        questions: currentQuestions,
      });
      currentQuestions = [];
    }
  };

  for (const q of survey.questions || []) {
    if (q.type === "section") {
      pushGeneral();
      currentTitle = q.title || null;
    } else if (q.type === "maxdiff") {
      pushGeneral();
      steps.push({ kind: "maxdiff", question: q });
      currentTitle = null;
    } else {
      currentQuestions.push(q);
    }
  }
  pushGeneral();

  // 백워드 호환: questions에 maxdiff 없고 items가 있으면 마지막에 추가
  const hasMaxdiff = steps.some((s) => s.kind === "maxdiff");
  if (!hasMaxdiff && survey.items && survey.items.length > 0) {
    steps.push({
      kind: "maxdiff",
      question: {
        id: "legacy-maxdiff",
        type: "maxdiff",
        title: survey.maxdiffTitle || "",
        options: survey.items,
        required: true,
        questionOrder: 9999,
      },
    });
  }

  return steps;
}

export default function SurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [respondentId, setRespondentId] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [stage, setStage] = useState<"job" | "survey" | "done">("job");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // 일반 문항 응답
  const [generalAnswers, setGeneralAnswers] = useState<
    { questionId: string; answer: string | string[] }[]
  >([]);
  const [generalError, setGeneralError] = useState("");

  // MaxDiff 라운드
  const [sets, setSets] = useState<SurveyItem[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [best, setBest] = useState<string | null>(null);
  const [worst, setWorst] = useState<string | null>(null);
  const [currentMaxdiffId, setCurrentMaxdiffId] = useState<string | null>(null);

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
          exposureCount.set(item.name, (exposureCount.get(item.name) || 0) + 1);
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

  const steps = useMemo(() => (survey ? buildSteps(survey) : []), [survey]);
  const currentStep = steps[currentStepIdx];

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
        if (data.questions?.length > 0) {
          setGeneralAnswers(
            data.questions
              .filter(
                (q: Question) => q.type !== "section" && q.type !== "maxdiff"
              )
              .map((q: Question) => ({
                questionId: q.id,
                answer: q.type === "multiple_choice" ? [] : "",
              }))
          );
        }
        if (!data.jobRoles || data.jobRoles.length === 0) {
          setStage("survey");
        }
      })
      .catch(() => setError("설문을 불러올 수 없습니다."));
  }, [surveyId]);

  // MaxDiff step 진입 시 sets 생성
  useEffect(() => {
    if (stage !== "survey" || !currentStep || !survey) return;
    if (currentStep.kind !== "maxdiff") return;
    if (currentMaxdiffId === currentStep.question.id) return;

    const items = (currentStep.question.options as SurveyItem[]) || [];
    if (items.length === 0) return;
    setSets(generateSets(items, survey.setSize));
    setCurrentRound(0);
    setBest(null);
    setWorst(null);
    setCurrentMaxdiffId(currentStep.question.id);
  }, [stage, currentStep, survey, generateSets, currentMaxdiffId]);

  // 일반 문항 및 모든 step 완료 시 설문 종료
  const finalizeSurvey = async () => {
    if (!survey) return;
    setSubmitting(true);
    try {
      await fetch(`/api/surveys/${surveyId}/general-responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respondentId, answers: generalAnswers }),
      });
    } catch {
      // 무시
    }
    setSubmitting(false);
    setStage("done");
  };

  const handleGeneralAnswer = (questionId: string, value: string | string[]) => {
    setGeneralAnswers((prev) =>
      prev.map((a) => (a.questionId === questionId ? { ...a, answer: value } : a))
    );
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

  const goToNextStep = async () => {
    if (currentStepIdx + 1 >= steps.length) {
      await finalizeSurvey();
    } else {
      setCurrentStepIdx((i) => i + 1);
      setGeneralError("");
    }
  };

  const goToPrevStep = () => {
    setGeneralError("");
    setCurrentStepIdx((i) => Math.max(0, i - 1));
  };

  const handleNextGeneral = async () => {
    if (!currentStep || currentStep.kind !== "general") return;
    for (const q of currentStep.questions) {
      if (!q.required) continue;
      const ans = generalAnswers.find((a) => a.questionId === q.id);
      const isEmpty =
        !ans ||
        (Array.isArray(ans.answer)
          ? ans.answer.length === 0
          : String(ans.answer).trim() === "");
      if (isEmpty) {
        setGeneralError("필수 입력 항목입니다.");
        return;
      }
    }
    setGeneralError("");
    await goToNextStep();
  };

  const submitRound = async () => {
    if (!best || !worst || !currentStep || currentStep.kind !== "maxdiff") return;
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
      setSubmitting(false);
      setBest(null);
      setWorst(null);
      await goToNextStep();
    } else {
      setCurrentRound(currentRound + 1);
      setBest(null);
      setWorst(null);
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <PageContent size="sm" className="text-center" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <Typography
          variant="body1"
          sx={(theme) => ({ color: theme.semantic.status.negative })}
        >
          {error}
        </Typography>
      </PageContent>
    );
  }

  if (!survey) {
    return (
      <PageContent size="sm" className="flex items-center justify-center gap-2" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <Loading variant="circular" size="24px" />
        <Typography
          variant="body2"
          sx={(theme) => ({ color: theme.semantic.label.alternative })}
        >
          설문을 불러오는 중...
        </Typography>
      </PageContent>
    );
  }

  if (stage === "done") {
    return (
      <PageContent size="sm" className="text-center" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <img src="/success.svg" alt="" className="mx-auto mb-4" />
        <Typography
          variant="title3"
          weight="bold"
          sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}
        >
          설문을 제출했어요!
        </Typography>
        <Typography
          variant="body1"
          sx={(theme) => ({ color: theme.semantic.label.alternative, marginTop: "4px", display: "block" })}
        >
          소중한 시간내어 참여해 주셔서 감사합니다.
        </Typography>
      </PageContent>
    );
  }

  // 직군 선택 화면
  if (stage === "job" && survey.jobRoles.length > 0) {
    return (
      <PageContent size="sm" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <Typography
          variant="title2"
          weight="bold"
          sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}
        >
          {survey.title}
        </Typography>
        <Typography
          variant="body2"
          sx={(theme) => ({
            color: theme.semantic.label.alternative,
            marginTop: "4px",
            marginBottom: "40px",
            display: "block",
          })}
        >
          설문을 시작하기 전에 직군을 선택해주세요.
        </Typography>

        <div className="space-y-2" style={{ marginBottom: 40 }} role="radiogroup">
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
          onClick={() => setStage("survey")}
          disabled={!jobRole}
          fullWidth
          size="large"
        >
          설문 시작하기
        </Button>
      </PageContent>
    );
  }

  if (!currentStep) {
    return (
      <PageContent size="sm" className="flex items-center justify-center gap-2" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <Loading variant="circular" size="24px" />
      </PageContent>
    );
  }

  const surveyHeader = (
    <Box
      sx={{
        marginBottom: "60px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <Typography
        variant="title2"
        weight="bold"
        sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}
      >
        {survey.title}
      </Typography>
      {survey.description && (
        <Typography
          variant="body1"
          weight="medium"
          sx={(theme) => ({
            color: theme.semantic.label.neutral,
            display: "block",
            whiteSpace: "pre-wrap",
          })}
        >
          {survey.description}
        </Typography>
      )}
    </Box>
  );

  // 일반 섹션 화면
  if (currentStep.kind === "general") {
    return (
      <PageContent size="sm" style={{ paddingTop: 60, paddingBottom: 60 }}>
        {surveyHeader}

        {/* Section Indicator */}
        <FlexBox alignItems="center" gap="8px" sx={{ padding: "6px 0", marginBottom: "40px" }}>
          <Box
            sx={(theme) => ({
              flex: 1,
              height: "1px",
              backgroundColor: theme.semantic.line.solid.neutral,
            })}
          />
          <ContentBadge color="accent" size="medium" variant="solid">
            섹션 {currentStepIdx + 1} / {steps.length}
          </ContentBadge>
          <Box
            sx={(theme) => ({
              flex: 1,
              height: "1px",
              backgroundColor: theme.semantic.line.solid.neutral,
            })}
          />
        </FlexBox>

        {/* 문항들 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {currentStep.questions.map((q) => {
            const ans = generalAnswers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FlexBox alignItems="center" gap="4px">
                  <Typography
                    variant="body1"
                    weight="medium"
                    sx={(theme) => ({ color: theme.semantic.label.neutral })}
                  >
                    {q.title}
                  </Typography>
                  {q.required && (
                    <Typography
                      variant="body1"
                      weight="medium"
                      sx={(theme) => ({ color: theme.semantic.status.negative })}
                    >
                      *
                    </Typography>
                  )}
                </FlexBox>

                {q.type === "multiple_choice" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px 0" }}>
                    {(q.options as string[]).map((opt, i) => {
                      const isChecked = Array.isArray(ans?.answer)
                        ? ans.answer.includes(opt)
                        : ans?.answer === opt;
                      return (
                        <label
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            cursor: "pointer",
                            padding: "1px 0",
                          }}
                        >
                          <input
                            type={q.multipleAnswers ? "checkbox" : "radio"}
                            name={`q-${q.id}`}
                            value={opt}
                            checked={isChecked}
                            onChange={() => {
                              if (q.multipleAnswers) {
                                const prev = Array.isArray(ans?.answer) ? ans.answer : [];
                                const next = prev.includes(opt)
                                  ? prev.filter((v) => v !== opt)
                                  : [...prev, opt];
                                handleGeneralAnswer(q.id, next);
                              } else {
                                handleGeneralAnswer(q.id, opt);
                              }
                            }}
                            style={{
                              width: 20,
                              height: 20,
                              accentColor: "#0066FF",
                              flexShrink: 0,
                              margin: 0,
                            }}
                          />
                          <Typography
                            variant="body1"
                            sx={(theme) => ({ color: theme.semantic.label.neutral })}
                          >
                            {opt}
                          </Typography>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === "short_answer" && (
                  <TextField
                    value={typeof ans?.answer === "string" ? ans.answer : ""}
                    onChange={(e) => handleGeneralAnswer(q.id, e.target.value)}
                    placeholder="텍스트를 입력해 주세요."
                    width="100%"
                  />
                )}

                {q.type === "long_answer" && (
                  <TextArea
                    value={typeof ans?.answer === "string" ? ans.answer : ""}
                    onChange={(e) => handleGeneralAnswer(q.id, e.target.value)}
                    placeholder="메시지를 입력해 주세요."
                    sx={{ width: "100%", resize: "none" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {generalError && (
          <Typography
            variant="body2"
            sx={(theme) => ({ color: theme.semantic.status.negative, marginTop: "12px", display: "block" })}
          >
            {generalError}
          </Typography>
        )}

        {/* 하단 액션 영역 */}
        <Box
          sx={{
            marginTop: "40px",
            display: "flex",
            gap: "8px",
          }}
        >
          {currentStepIdx > 0 && (
            <Button
              variant="outlined"
              color="assistive"
              size="large"
              onClick={goToPrevStep}
            >
              이전
            </Button>
          )}
          <Button
            onClick={handleNextGeneral}
            disabled={submitting}
            size="large"
            sx={{ flex: 1 }}
          >
            {submitting ? "저장 중..." : "다음"}
          </Button>
        </Box>
      </PageContent>
    );
  }

  // MaxDiff 라운드 화면
  if (sets.length === 0) {
    return (
      <PageContent size="sm" className="flex items-center justify-center gap-2" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <Loading variant="circular" size="24px" />
      </PageContent>
    );
  }

  const currentSet = sets[currentRound];
  const bestLabel = survey.bestLabel || "가장 중요";
  const worstLabel = survey.worstLabel || "가장 덜 중요";
  const maxdiffTitle =
    currentStep.question.title ||
    survey.maxdiffTitle ||
    `${bestLabel}한 것과 ${worstLabel}한 것을 1개씩 선택해 주세요.`;

  return (
    <PageContent size="sm" style={{ paddingTop: 60, paddingBottom: 60 }}>
      {surveyHeader}

      {/* Section Indicator */}
      <FlexBox alignItems="center" gap="8px" sx={{ padding: "6px 0", marginBottom: "40px" }}>
        <Box
          sx={(theme) => ({
            flex: 1,
            height: "1px",
            backgroundColor: theme.semantic.line.solid.neutral,
          })}
        />
        <ContentBadge color="accent" size="medium" variant="solid">
          섹션 {currentStepIdx + 1} / {steps.length}
        </ContentBadge>
        <Box
          sx={(theme) => ({
            flex: 1,
            height: "1px",
            backgroundColor: theme.semantic.line.solid.neutral,
          })}
        />
      </FlexBox>

      {/* 문항명 */}
      <Typography
        variant="body1"
        weight="medium"
        sx={(theme) => ({
          color: theme.semantic.label.neutral,
          display: "block",
          marginBottom: "40px",
          whiteSpace: "pre-wrap",
        })}
      >
        {maxdiffTitle}
      </Typography>

      {/* Options */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "32px",
          marginBottom: "40px",
        }}
      >
        {currentSet.map((item) => {
          const isBest = best === item.name;
          const isWorst = worst === item.name;

          return (
            <div
              key={item.name}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <Typography
                variant="label1"
                weight="bold"
                sx={(theme) => ({ color: theme.semantic.label.neutral })}
              >
                {item.name}
              </Typography>
              {item.image ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid rgba(112, 115, 124, 0.16)",
                    backgroundColor: "#F4F4F5",
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: "12px",
                    backgroundColor: "#F4F4F5",
                    border: "1px solid rgba(112, 115, 124, 0.16)",
                  }}
                />
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  width: "100%",
                }}
              >
                <Button
                  variant="outlined"
                  color={isBest ? "primary" : "assistive"}
                  size="large"
                  onClick={() => handleSelect(item.name, "best")}
                  sx={(theme) => ({
                    width: "100%",
                    minWidth: 0,
                    ...(isBest && {
                      boxShadow: `inset 0 0 0 1px ${theme.semantic.primary.normal}`,
                    }),
                  })}
                >
                  {bestLabel}
                </Button>
                <Button
                  variant="outlined"
                  color="assistive"
                  size="large"
                  onClick={() => handleSelect(item.name, "worst")}
                  sx={(theme) => ({
                    width: "100%",
                    minWidth: 0,
                    ...(isWorst && {
                      color: theme.semantic.status.cautionary,
                      boxShadow: `inset 0 0 0 1px ${theme.semantic.status.cautionary}`,
                    }),
                  })}
                >
                  {worstLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 액션 영역 */}
      <Box sx={{ marginTop: "40px", display: "flex", gap: "8px" }}>
        {(currentRound > 0 || currentStepIdx > 0) && (
          <Button
            variant="outlined"
            color="assistive"
            size="large"
            onClick={() => {
              if (currentRound > 0) {
                setCurrentRound(currentRound - 1);
                setBest(null);
                setWorst(null);
              } else {
                goToPrevStep();
              }
            }}
          >
            이전
          </Button>
        )}
        <Button
          onClick={submitRound}
          disabled={!best || !worst || submitting}
          size="large"
          sx={{ flex: 1 }}
        >
          {submitting
            ? "제출 중..."
            : currentRound + 1 < sets.length
            ? "다음"
            : currentStepIdx + 1 < steps.length
            ? "다음"
            : "완료"}
        </Button>
      </Box>
    </PageContent>
  );
}
