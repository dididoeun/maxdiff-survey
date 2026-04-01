"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Button,
  ContentBadge,
  FlexBox,
  IconButton,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextField,
  Typography,
} from "@wanteddev/wds";
import { IconClose, IconCopy, IconDownload } from "@wanteddev/wds-icon";
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

  const [currentUserId, setCurrentUserId] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const [generalResponses, setGeneralResponses] = useState<GeneralResponseRow[]>([]);

  useEffect(() => {
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

        const uniqueRespondents = new Set(responses.map((r: Response) => r.respondentId));
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

  function calculateScores(items: SurveyItem[], responses: Response[]): ScoreData[] {
    const stats = new Map<string, { bestCount: number; worstCount: number; exposureCount: number }>();
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
      const s = stats.get(item.name) || { bestCount: 0, worstCount: 0, exposureCount: 0 };
      const rawScore =
        s.exposureCount > 0 ? (s.bestCount - s.worstCount) / s.exposureCount : 0;
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
      .map((s) => `${s.name},${s.bestCount},${s.worstCount},${s.exposureCount},${s.score}`)
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
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
    typeof window !== "undefined" ? `${window.location.origin}/survey/${surveyId}` : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getQuestionStats = (question: Question) => {
    const qResponses = generalResponses.filter((r) => r.questionId === question.id);
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
      <div className="px-8 py-12 text-center max-w-4xl mx-auto">
        <Typography
          variant="body1"
          sx={(theme) => ({ color: theme.semantic.status.negative })}
        >
          {error}
        </Typography>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="px-8 py-12 text-center max-w-4xl mx-auto">
        <Typography
          variant="body1"
          sx={(theme) => ({ color: theme.semantic.label.alternative })}
        >
          로딩 중...
        </Typography>
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
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px 20px" }}>
      {/* 헤더 */}
      <div>
        <Typography
          variant="body2"
          sx={(theme) => ({ color: theme.semantic.label.alternative })}
        >
          총 응답자 {respondentCount}명 · 항목 {survey.items.length}개
        </Typography>
      </div>

      <div style={{ height: "20px" }} />

      {/* 탭 */}
      <Tab defaultValue="chart" onValueChange={setActiveTab}>
        <FlexBox
          alignItems="center"
          justifyContent="space-between"
          sx={(theme) => ({
            marginBottom: "24px",
            height: "48px",
          })}
        >
          <TabList size="small">
            <TabListItem value="chart">MaxDiff 점수</TabListItem>
            <TabListItem value="table">상세 테이블</TabListItem>
            <TabListItem value="matrix">Matrix 분석</TabListItem>
            {hasQuestions && <TabListItem value="general">일반 문항</TabListItem>}
          </TabList>
          {activeTab === "table" && (
            <Button
              variant="solid"
              color="primary"
              size="small"
              trailingContent={<IconDownload sx={{ fontSize: "14px" }} />}
              onClick={downloadCSV}
            >
              CSV 다운로드
            </Button>
          )}
        </FlexBox>

        {/* 막대 차트 */}
        <TabPanel value="chart" style={{ paddingTop: "20px" }}>
          <Box
            sx={(theme) => ({
              backgroundColor: theme.semantic.fill.normal,
              borderRadius: "8px",
              padding: "24px 16px",
            })}
          >
            {scores.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, scores.length * 45)}>
                <BarChart
                  data={scores}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 13 }} />
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
              <Typography
                variant="body2"
                sx={(theme) => ({ color: theme.semantic.label.alternative, textAlign: "center", padding: "48px 0", display: "block" })}
              >
                아직 응답 데이터가 없습니다.
              </Typography>
            )}
          </Box>
        </TabPanel>

        {/* 상세 테이블 */}
        <TabPanel value="table" style={{ paddingTop: "20px" }}>
          <Box
            sx={(theme) => ({
              border: `1px solid ${theme.semantic.line.solid.normal}`,
              borderRadius: "8px",
              overflow: "hidden",
            })}
          >
            <Table>
              <TableHead sx={(theme) => ({ backgroundColor: theme.semantic.fill.normal })}>
                <TableRow>
                  <TableHeadCell sx={{ paddingLeft: "24px", paddingRight: "16px" }}>순위</TableHeadCell>
                  <TableHeadCell sx={{ padding: "0 16px" }}>항목명</TableHeadCell>
                  <TableHeadCell sx={(theme) => ({ padding: "0 16px", textAlign: "right", color: theme.semantic.status.negative })}>가장 시급</TableHeadCell>
                  <TableHeadCell sx={{ padding: "0 16px", textAlign: "right", color: "#16A34A" }}>가장 덜 시급</TableHeadCell>
                  <TableHeadCell sx={{ padding: "0 16px", textAlign: "right" }}>노출 횟수</TableHeadCell>
                  <TableHeadCell sx={{ paddingLeft: "16px", paddingRight: "24px", textAlign: "right" }}>점수</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scores.map((s, i) => (
                  <TableRow key={s.name}>
                    <TableCell sx={(theme) => ({ paddingLeft: "24px", paddingRight: "16px", color: theme.semantic.label.alternative })}>
                      {i + 1}
                    </TableCell>
                    <TableCell sx={(theme) => ({ padding: "0 16px", fontWeight: 500, color: theme.semantic.label.normal })}>
                      {s.name}
                    </TableCell>
                    <TableCell sx={(theme) => ({ padding: "0 16px", textAlign: "right", fontWeight: 500, color: theme.semantic.status.negative })}>
                      {s.bestCount}
                    </TableCell>
                    <TableCell sx={{ padding: "0 16px", textAlign: "right", fontWeight: 500, color: "#16A34A" }}>
                      {s.worstCount}
                    </TableCell>
                    <TableCell sx={(theme) => ({ padding: "0 16px", textAlign: "right", color: theme.semantic.label.alternative })}>
                      {s.exposureCount}
                    </TableCell>
                    <TableCell sx={(theme) => ({ paddingLeft: "16px", paddingRight: "24px", textAlign: "right", fontWeight: 700, color: theme.semantic.label.normal })}>
                      {s.score}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {scores.length === 0 && (
              <Typography
                variant="body2"
                sx={(theme) => ({ color: theme.semantic.label.alternative, textAlign: "center", padding: "48px 0", display: "block" })}
              >
                아직 응답 데이터가 없습니다.
              </Typography>
            )}
          </Box>
        </TabPanel>

        {/* Matrix 분석 */}
        <TabPanel value="matrix" style={{ paddingTop: "20px" }}>
          <FlexBox alignItems="flex-start" justifyContent="space-between" gap="16px" sx={{ marginBottom: "16px" }}>
            <Typography
              variant="body2"
              sx={(theme) => ({ color: theme.semantic.label.alternative })}
            >
              외부 데이터 CSV를 업로드하세요. (형식: 항목명,사용빈도점수)
            </Typography>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleMatrixCSV}
                className="hidden"
              />
              <Button
                variant="solid"
                color="assistive"
                size="small"
                onClick={() => fileInputRef.current?.click()}
              >
                CSV 업로드
              </Button>
            </div>
          </FlexBox>
          {matrixData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" domain={[0, 100]} name="사용 빈도" tick={{ fontSize: 12 }}>
                    <Label value="사용 빈도 점수" offset={-10} position="insideBottom" />
                  </XAxis>
                  <YAxis type="number" dataKey="y" domain={[0, 100]} name="개선 시급도" tick={{ fontSize: 12 }}>
                    <Label value="개선 시급도 (MaxDiff 점수)" angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} />
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
                      return <Cell key={i} fill={QUADRANT_COLORS[colorIdx]} r={8} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-3 mt-4 max-w-lg mx-auto">
                {[
                  { color: "#F59E0B", label: "좌상단: 정리 및 재설계 논의 필요" },
                  { color: "#10B981", label: "우상단: 중점 개선 영역" },
                  { color: "#9CA3AF", label: "좌하단: 특정 상황에 최적화된 컴포넌트" },
                  { color: "#3B82F6", label: "우하단: 안정된 컴포넌트" },
                ].map(({ color, label }) => (
                  <FlexBox
                    key={label}
                    alignItems="center"
                    gap="8px"
                    sx={(theme) => ({
                      border: `1px solid ${theme.semantic.line.solid.normal}`,
                      borderRadius: "8px",
                      padding: "8px 12px",
                    })}
                  >
                    <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                    <Typography variant="caption1" sx={(theme) => ({ color: theme.semantic.label.normal })}>
                      {label}
                    </Typography>
                  </FlexBox>
                ))}
              </div>

              <div className="mt-6 border-t pt-4">
                <Typography
                  variant="body2"
                  weight="medium"
                  sx={(theme) => ({ color: theme.semantic.label.normal, marginBottom: "8px", display: "block" })}
                >
                  항목별 좌표
                </Typography>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {matrixData.map((d) => (
                    <Box
                      key={d.name}
                      sx={(theme) => ({
                        backgroundColor: theme.semantic.fill.normal,
                        borderRadius: "8px",
                        padding: "8px 12px",
                      })}
                    >
                      <Typography variant="caption1" weight="medium" sx={(theme) => ({ color: theme.semantic.label.normal })}>
                        {d.name}
                      </Typography>
                      <Typography variant="caption1" sx={(theme) => ({ color: theme.semantic.label.alternative, marginLeft: "4px" })}>
                        ({d.x}, {d.y})
                      </Typography>
                    </Box>
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
        </TabPanel>

        {/* 일반 문항 탭 */}
        {hasQuestions && (
          <TabPanel value="general">
            <div className="space-y-6">
              {survey.questions.map((q) => {
                const stats = getQuestionStats(q);
                return (
                  <Box
                    key={q.id}
                    sx={(theme) => ({
                      border: `1px solid ${theme.semantic.line.solid.normal}`,
                      borderRadius: "8px",
                      overflow: "hidden",
                    })}
                  >
                    <FlexBox
                      alignItems="flex-start"
                      gap="8px"
                      sx={(theme) => ({
                        padding: "16px 20px 12px",
                        borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
                      })}
                    >
                      <ContentBadge color="neutral" size="xsmall" sx={{ flexShrink: 0, marginTop: "2px" }}>
                        {q.type === "multiple_choice"
                          ? "객관식"
                          : q.type === "short_answer"
                          ? "단답형"
                          : "장문형"}
                      </ContentBadge>
                      <Typography
                        variant="body2"
                        weight="medium"
                        sx={(theme) => ({ color: theme.semantic.label.normal, lineHeight: "1.4" })}
                      >
                        {q.title || "(제목 없음)"}
                      </Typography>
                    </FlexBox>
                    <div className="px-5 pb-5 pt-4">
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
                            <Typography
                              variant="body2"
                              sx={(theme) => ({ color: theme.semantic.label.alternative })}
                            >
                              아직 응답이 없습니다.
                            </Typography>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stats.answers.length === 0 ? (
                            <Typography
                              variant="body2"
                              sx={(theme) => ({ color: theme.semantic.label.alternative })}
                            >
                              아직 응답이 없습니다.
                            </Typography>
                          ) : (
                            stats.answers.map((ans, i) => (
                              <Box
                                key={i}
                                sx={(theme) => ({
                                  backgroundColor: theme.semantic.fill.normal,
                                  borderRadius: "8px",
                                  padding: "8px 12px",
                                })}
                              >
                                <Typography
                                  variant="body2"
                                  sx={(theme) => ({ color: theme.semantic.label.normal })}
                                >
                                  {ans}
                                </Typography>
                              </Box>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </Box>
                );
              })}
            </div>
          </TabPanel>
        )}
      </Tab>
    </div>
  );
}
