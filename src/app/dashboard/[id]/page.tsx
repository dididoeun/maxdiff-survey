"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, Download, X } from "lucide-react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  ReferenceLine,
  ReferenceArea,
  Label,
} from "recharts";

interface SurveyItem {
  name: string;
  image?: string;
}

interface Question {
  id: string;
  type: "multiple_choice" | "short_answer" | "long_answer";
  title: string;
  options: string[];
  required: boolean;
  questionOrder: number;
}

interface Survey {
  id: string;
  title: string;
  items: SurveyItem[];
  setSize: number;
  userId: string;
  questions: Question[];
}

interface Response {
  setBatch: string[];
  bestItem: string;
  worstItem: string;
  respondentId: string;
}

interface ScoreData {
  name: string;
  bestCount: number;
  worstCount: number;
  exposureCount: number;
  rawScore: number;
  score: number;
}

interface MatrixData {
  name: string;
  x: number;
  y: number;
}

interface AdminUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string;
  createdAt: string;
}

interface GeneralResponseRow {
  questionId: string;
  respondentId: string;
  answer: string;
  title: string;
  type: string;
  options: string[];
}

export default function DashboardPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [respondentCount, setRespondentCount] = useState(0);
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("chart");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 공동 관리자
  const [currentUserId, setCurrentUserId] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  // 일반 문항 응답
  const [generalResponses, setGeneralResponses] = useState<GeneralResponseRow[]>([]);

  useEffect(() => {
    // 현재 로그인 유저 정보 가져오기
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        if (session?.user?.id) setCurrentUserId(session.user.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/surveys/${surveyId}`).then((r) => r.json()),
      fetch(`/api/surveys/${surveyId}/responses`).then((r) => r.json()),
      fetch(`/api/surveys/${surveyId}/general-responses`).then((r) => r.json()),
    ])
      .then(([surveyData, responses, genResponses]) => {
        if (surveyData.error) {
          setError(surveyData.error);
          return;
        }
        setSurvey(surveyData);

        const uniqueRespondents = new Set(
          responses.map((r: Response) => r.respondentId)
        );
        setRespondentCount(uniqueRespondents.size);

        const calculated = calculateScores(surveyData.items, responses);
        setScores(calculated);

        if (!genResponses.error) {
          setGeneralResponses(genResponses);
        }
      })
      .catch(() => setError("데이터를 불러올 수 없습니다."));
  }, [surveyId]);

  useEffect(() => {
    if (!survey || !currentUserId) return;
    const ownerCheck = survey.userId === currentUserId;
    setIsOwner(ownerCheck);
    if (ownerCheck) {
      fetch(`/api/surveys/${surveyId}/admins`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setAdmins(data);
        })
        .catch(() => {});
    }
  }, [survey, currentUserId, surveyId]);

  function calculateScores(
    items: SurveyItem[],
    responses: Response[]
  ): ScoreData[] {
    const stats = new Map<
      string,
      { bestCount: number; worstCount: number; exposureCount: number }
    >();
    items.forEach((item) => {
      stats.set(item.name, { bestCount: 0, worstCount: 0, exposureCount: 0 });
    });

    responses.forEach((r) => {
      r.setBatch.forEach((itemName) => {
        const s = stats.get(itemName);
        if (s) s.exposureCount++;
      });
      const b = stats.get(r.bestItem);
      if (b) b.bestCount++;
      const w = stats.get(r.worstItem);
      if (w) w.worstCount++;
    });

    const results = items.map((item) => {
      const s = stats.get(item.name) || {
        bestCount: 0,
        worstCount: 0,
        exposureCount: 0,
      };
      const rawScore =
        s.exposureCount > 0
          ? (s.bestCount - s.worstCount) / s.exposureCount
          : 0;
      return { name: item.name, ...s, rawScore, score: 0 };
    });

    const rawScores = results.map((r) => r.rawScore);
    const minRaw = Math.min(...rawScores);
    const maxRaw = Math.max(...rawScores);
    const range = maxRaw - minRaw;

    results.forEach((r) => {
      r.score = range > 0 ? Math.round(((r.rawScore - minRaw) / range) * 100) : 50;
    });

    return results.sort((a, b) => b.score - a.score);
  }

  const downloadCSV = () => {
    const header = "항목명,Best횟수,Worst횟수,노출횟수,점수\n";
    const rows = scores
      .map(
        (s) =>
          `${s.name},${s.bestCount},${s.worstCount},${s.exposureCount},${s.score}`
      )
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maxdiff_${surveyId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMatrixCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n").slice(1);
      const data: MatrixData[] = [];
      lines.forEach((line) => {
        const [name, xStr] = line.split(",").map((s) => s.trim());
        const x = parseFloat(xStr);
        const scoreItem = scores.find((s) => s.name === name);
        if (scoreItem && !isNaN(x)) {
          data.push({ name, x, y: scoreItem.score });
        }
      });
      setMatrixData(data);
    };
    reader.readAsText(file);
  };

  const addAdmin = async () => {
    if (!adminEmail.trim()) return;
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminError(data.error || "추가에 실패했습니다.");
      } else {
        setAdminEmail("");
        // 목록 새로고침
        const updated = await fetch(`/api/surveys/${surveyId}/admins`).then((r) => r.json());
        if (!updated.error) setAdmins(updated);
      }
    } catch {
      setAdminError("추가에 실패했습니다.");
    }
    setAdminLoading(false);
  };

  const removeAdmin = async (userId: string) => {
    try {
      await fetch(`/api/surveys/${surveyId}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setAdmins(admins.filter((a) => a.userId !== userId));
    } catch {
      // ignore
    }
  };

  const surveyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/survey/${surveyId}`
      : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 일반 문항별 응답 집계
  const getQuestionStats = (question: Question) => {
    const qResponses = generalResponses.filter(
      (r) => r.questionId === question.id
    );
    if (question.type === "multiple_choice") {
      const counts: Record<string, number> = {};
      question.options.forEach((opt) => (counts[opt] = 0));
      qResponses.forEach((r) => {
        try {
          const ans = JSON.parse(r.answer);
          if (Array.isArray(ans)) {
            ans.forEach((a) => { if (a in counts) counts[a]++; });
          } else if (typeof ans === "string" && ans in counts) {
            counts[ans]++;
          }
        } catch {
          if (r.answer in counts) counts[r.answer]++;
        }
      });
      const total = qResponses.length;
      return { type: "multiple_choice" as const, counts, total };
    }
    return {
      type: question.type as "short_answer" | "long_answer",
      answers: qResponses.map((r) => r.answer),
    };
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const hasQuestions = survey.questions && survey.questions.length > 0;

  const COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  ];

  const QUADRANT_COLORS = ["#10B981", "#F59E0B", "#3B82F6", "#9CA3AF"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {survey.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>총 응답자 {respondentCount}명 · 항목 {survey.items.length}개</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Input
            readOnly
            value={surveyUrl}
            className="flex-1 h-10 px-3.5"
          />
          <Button variant="outline" onClick={copyUrl} size="sm" className="h-10 px-3.5 rounded-[0.625rem] gap-1.5">
            <Copy className="size-3.5" />
            {copied ? "복사됨!" : "URL 복사"}
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="chart" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6 border-b border-border h-12">
          <TabsList variant="line" className="!h-12 gap-3 !p-0 !pb-[3px]">
            <TabsTrigger value="chart" className="text-base px-0">MaxDiff 점수</TabsTrigger>
            <TabsTrigger value="table" className="text-base px-0">상세 테이블</TabsTrigger>
            <TabsTrigger value="matrix" className="text-base px-0">Matrix 분석</TabsTrigger>
            {hasQuestions && (
              <TabsTrigger value="general" className="text-base px-0">일반 문항</TabsTrigger>
            )}
          </TabsList>
          {activeTab === "table" && (
            <Button
              variant="default"
              onClick={downloadCSV}
              size="sm"
              className="h-8 w-[118px] gap-1.5"
            >
              CSV 다운로드
              <Download className="size-3.5" />
            </Button>
          )}
        </div>

        {/* 막대 차트 */}
        <TabsContent value="chart">
          <Card className="py-0 bg-muted/50">
            <CardContent className="px-4 py-6">
              {scores.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, scores.length * 45)}>
                  <BarChart
                    data={scores}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={90}
                      tick={{ fontSize: 13 }}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const d = payload[0].payload as { name: string; score: number };
                        return (
                          <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-md">
                            <p className="font-medium">{d.name}</p>
                            <p className="text-muted-foreground">{d.score}점</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {scores.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-12">
                  아직 응답 데이터가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 상세 테이블 */}
        <TabsContent value="table">
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-6 pr-4">순위</TableHead>
                    <TableHead className="px-4">항목명</TableHead>
                    <TableHead className="px-4 text-right text-red-600">가장 시급</TableHead>
                    <TableHead className="px-4 text-right text-green-600">가장 덜 시급</TableHead>
                    <TableHead className="px-4 text-right">노출 횟수</TableHead>
                    <TableHead className="pl-4 pr-6 text-right">점수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s, i) => (
                    <TableRow key={s.name}>
                      <TableCell className="pl-6 pr-4 text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="px-4 font-medium">
                        {s.name}
                      </TableCell>
                      <TableCell className="px-4 text-right text-red-600 font-medium">
                        {s.bestCount}
                      </TableCell>
                      <TableCell className="px-4 text-right text-green-600 font-medium">
                        {s.worstCount}
                      </TableCell>
                      <TableCell className="px-4 text-right text-muted-foreground">
                        {s.exposureCount}
                      </TableCell>
                      <TableCell className="pl-4 pr-6 text-right font-bold">
                        {s.score}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {scores.length === 0 && (
                <p className="text-muted-foreground text-center py-12">
                  아직 응답 데이터가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matrix 분석 */}
        <TabsContent value="matrix">
          <div className="flex items-start justify-between gap-4 mb-4">
            <p className="text-sm text-muted-foreground">
              외부 데이터 CSV를 업로드하세요. (형식: 항목명,사용빈도점수)
            </p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleMatrixCSV}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-3.5"
                onClick={() => fileInputRef.current?.click()}
              >
                CSV 업로드
              </Button>
            </div>
          </div>
              {matrixData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={500}>
                    <ScatterChart
                      margin={{ top: 20, right: 40, bottom: 40, left: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0, 100]}
                        name="사용 빈도"
                        tick={{ fontSize: 12 }}
                      >
                        <Label value="사용 빈도 점수" offset={-10} position="insideBottom" />
                      </XAxis>
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0, 100]}
                        name="개선 시급도"
                        tick={{ fontSize: 12 }}
                      >
                        <Label
                          value="개선 시급도 (MaxDiff 점수)"
                          angle={-90}
                          position="insideLeft"
                          style={{ textAnchor: "middle" }}
                        />
                      </YAxis>
                      <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="#DCFCE7" fillOpacity={0.5} />
                      <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#FEF3C7" fillOpacity={0.5} />
                      <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="#DBEAFE" fillOpacity={0.5} />
                      <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="#F3F4F6" fillOpacity={0.5} />
                      <ReferenceLine x={50} stroke="#9CA3AF" strokeDasharray="4 4" />
                      <ReferenceLine y={50} stroke="#9CA3AF" strokeDasharray="4 4" />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload || payload.length === 0) return null;
                          const d = payload[0].payload as MatrixData;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 text-sm">
                              <p className="font-bold">{d.name}</p>
                              <p>사용 빈도: {d.x}</p>
                              <p>개선 시급도: {d.y}</p>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={matrixData}>
                        {matrixData.map((d, i) => {
                          let colorIdx = 3;
                          if (d.x >= 50 && d.y >= 50) colorIdx = 0;
                          else if (d.x < 50 && d.y >= 50) colorIdx = 1;
                          else if (d.x >= 50 && d.y < 50) colorIdx = 2;
                          return (
                            <Cell
                              key={i}
                              fill={QUADRANT_COLORS[colorIdx]}
                              r={8}
                            />
                          );
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>

                  {/* 사분면 레전드 */}
                  <div className="grid grid-cols-2 gap-3 mt-4 max-w-lg mx-auto">
                    <Badge variant="outline" className="justify-start gap-2 py-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 flex-shrink-0" />
                      좌상단: 정리 및 재설계 논의 필요
                    </Badge>
                    <Badge variant="outline" className="justify-start gap-2 py-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                      우상단: 중점 개선 영역
                    </Badge>
                    <Badge variant="outline" className="justify-start gap-2 py-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
                      좌하단: 특정 상황에 최적화된 컴포넌트
                    </Badge>
                    <Badge variant="outline" className="justify-start gap-2 py-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                      우하단: 안정된 컴포넌트
                    </Badge>
                  </div>

                  {/* 항목 라벨 목록 */}
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      항목별 좌표
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {matrixData.map((d) => (
                        <div
                          key={d.name}
                          className="text-xs bg-muted rounded-lg px-3 py-2"
                        >
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground ml-1">
                            ({d.x}, {d.y})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="mb-2">CSV 파일을 업로드하면 Matrix 차트가 표시됩니다.</p>
                  <p className="text-xs">
                    CSV 형식 예시:<br />
                    항목명,사용빈도점수<br />
                    Button,85<br />
                    Modal,45
                  </p>
                </div>
              )}
        </TabsContent>

        {/* 일반 문항 탭 */}
        {hasQuestions && (
          <TabsContent value="general">
            <div className="space-y-6">
              {survey.questions.map((q) => {
                const stats = getQuestionStats(q);
                return (
                  <Card key={q.id} className="py-0">
                    <CardHeader className="pb-3 pt-4 px-5">
                      <div className="flex items-start gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">
                          {q.type === "multiple_choice" ? "객관식" : q.type === "short_answer" ? "단답형" : "장문형"}
                        </Badge>
                        <CardTitle className="text-sm font-medium text-foreground leading-snug">
                          {q.title || "(제목 없음)"}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {stats.type === "multiple_choice" ? (
                        <div className="space-y-2">
                          {Object.entries(stats.counts).map(([opt, count]) => {
                            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                            return (
                              <div key={opt} className="flex items-center gap-3">
                                <span className="text-sm text-foreground w-28 shrink-0 truncate">{opt}</span>
                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                                  {count}명 ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                          {stats.total === 0 && (
                            <p className="text-sm text-muted-foreground">아직 응답이 없습니다.</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stats.answers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">아직 응답이 없습니다.</p>
                          ) : (
                            stats.answers.map((ans, i) => (
                              <div
                                key={i}
                                className="text-sm text-foreground bg-muted rounded-lg px-3 py-2"
                              >
                                {ans}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* 공동 관리자 관리 섹션 (소유자에게만 표시) */}
      {isOwner && (
        <Card className="mt-8 py-0">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold">공동 관리자</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* 추가 폼 */}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addAdmin();
              }}
            >
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="초대할 이메일 주소"
                className="flex-1 h-9 px-3"
              />
              <Button
                type="submit"
                size="sm"
                className="h-9 px-3.5"
                disabled={adminLoading || !adminEmail.trim()}
              >
                {adminLoading ? "추가 중..." : "추가"}
              </Button>
            </form>
            {adminError && (
              <p className="text-sm text-red-500">{adminError}</p>
            )}

            {/* 공동 관리자 목록 */}
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                공동 관리자가 없습니다. 이메일로 추가해주세요.
              </p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.userId}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    {admin.image ? (
                      <img
                        src={admin.image}
                        alt={admin.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                        {admin.name?.[0] || "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{admin.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAdmin(admin.userId)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
