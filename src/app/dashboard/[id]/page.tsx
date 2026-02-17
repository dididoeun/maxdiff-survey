"use client";

import { useEffect, useState, useRef } from "react";
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

interface Survey {
  id: string;
  title: string;
  items: SurveyItem[];
  setSize: number;
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

export default function DashboardPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [respondentCount, setRespondentCount] = useState(0);
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/surveys/${surveyId}`).then((r) => r.json()),
      fetch(`/api/surveys/${surveyId}/responses`).then((r) => r.json()),
    ])
      .then(([surveyData, responses]) => {
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
      })
      .catch(() => setError("데이터를 불러올 수 없습니다."));
  }, [surveyId]);

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

  const surveyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/survey/${surveyId}`
      : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  ];

  const QUADRANT_COLORS = ["#10B981", "#F59E0B", "#3B82F6", "#9CA3AF"];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          {survey.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>총 응답자: {respondentCount}명</span>
          <span>항목: {survey.items.length}개</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Input
            readOnly
            value={surveyUrl}
            className="max-w-md h-10 px-3.5"
          />
          <Button variant="outline" onClick={copyUrl} size="sm" className="h-10 px-3.5 rounded-[0.625rem]">
            {copied ? "복사됨!" : "URL 복사"}
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="chart">
        <TabsList className="mb-6">
          <TabsTrigger value="chart">막대 차트</TabsTrigger>
          <TabsTrigger value="table">상세 테이블</TabsTrigger>
          <TabsTrigger value="matrix">Matrix 분석</TabsTrigger>
        </TabsList>

        {/* 막대 차트 */}
        <TabsContent value="chart">
          <Card className="py-6">
            <CardHeader className="px-6">
              <CardTitle>MaxDiff 점수 (0~100)</CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              {scores.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, scores.length * 45)}>
                  <BarChart
                    data={scores}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
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
                      formatter={(value) => [`${value}점`, "점수"]}
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
          <Card className="py-6">
            <CardHeader className="flex-row items-center justify-between space-y-0 px-6 gap-3">
              <CardTitle>항목별 상세 데이터</CardTitle>
              <Button
                variant="secondary"
                onClick={downloadCSV}
                size="sm"
                className="h-8 px-3.5 !gap-0"
              >
                CSV 다운로드
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">순위</TableHead>
                    <TableHead className="px-4">항목명</TableHead>
                    <TableHead className="px-4 text-right">Best 횟수</TableHead>
                    <TableHead className="px-4 text-right">Worst 횟수</TableHead>
                    <TableHead className="px-4 text-right">노출 횟수</TableHead>
                    <TableHead className="px-4 text-right">점수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s, i) => (
                    <TableRow key={s.name}>
                      <TableCell className="px-4 text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="px-4 font-medium">
                        {s.name}
                      </TableCell>
                      <TableCell className="px-4 text-right text-green-600 font-medium">
                        {s.bestCount}
                      </TableCell>
                      <TableCell className="px-4 text-right text-red-600 font-medium">
                        {s.worstCount}
                      </TableCell>
                      <TableCell className="px-4 text-right text-muted-foreground">
                        {s.exposureCount}
                      </TableCell>
                      <TableCell className="px-4 text-right font-bold text-blue-600">
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
          <Card className="py-6">
            <CardHeader className="flex-row items-start justify-between space-y-0 gap-4 px-6">
              <div>
                <CardTitle>Matrix 분석 (4사분면)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  외부 데이터 CSV를 업로드하세요. (형식: 항목명,사용빈도점수)
                </p>
              </div>
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
            </CardHeader>
            <CardContent className="px-6">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
