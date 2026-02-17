"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ItemInput {
  id: string;
  name: string;
  image?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ItemInput[]>([]);
  const [setSize, setSetSize] = useState(4);
  const [newItemName, setNewItemName] = useState("");
  const [jobRoles, setJobRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");
  const [uploading, setUploading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const addItem = () => {
    if (!newItemName.trim()) return;
    setItems([
      ...items,
      { id: crypto.randomUUID(), name: newItemName.trim() },
    ]);
    setNewItemName("");
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleImageUpload = async (itemId: string, file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.path) {
        setItems(
          items.map((i) => (i.id === itemId ? { ...i, image: data.path } : i))
        );
      }
    } catch {
      alert("이미지 업로드에 실패했습니다.");
    }
    setUploading(false);
  };

  const createSurvey = async () => {
    if (!title.trim()) return alert("설문 제목을 입력해주세요.");
    if (items.length < 2)
      return alert("최소 2개 이상의 항목을 추가해주세요.");

    setCreating(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          items: items.map((i) => ({ name: i.name, image: i.image })),
          setSize,
          jobRoles,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setCreatedId(data.id);
      }
    } catch {
      alert("설문 생성에 실패했습니다.");
    }
    setCreating(false);
  };

  const surveyUrl =
    createdId && typeof window !== "undefined"
      ? `${window.location.origin}/survey/${createdId}`
      : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdId) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <img src="/success.svg" alt="" className="mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-foreground">설문을 만들었어요!</h2>
        <p className="text-muted-foreground mt-1 mb-6">아래 URL을 응답자에게 공유하세요.</p>

        <div className="flex items-center gap-2 mb-6">
          <Input readOnly value={surveyUrl} className="h-10 px-3.5" />
          <Button variant="outline" onClick={copyUrl} className="whitespace-nowrap h-10 px-3.5">
            {copied ? "복사됨!" : "URL 복사"}
          </Button>
        </div>

        <div className="flex gap-2 justify-center">
          <Button
            variant="secondary"
            onClick={() => router.push(`/survey/${createdId}`)}
          >
            설문 미리보기
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push(`/dashboard/${createdId}`)}
          >
            대시보드 보기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-8">
        새 MaxDiff 설문 만들기
      </h1>

      {/* 설문 제목 */}
      <div className="mb-6">
        <Label htmlFor="title">설문 제목</Label>
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: WDS 컴포넌트 개선 시급도 조사"
          className="mt-2 h-10 px-3.5"
        />
      </div>

      {/* 세트 크기 */}
      <div className="mb-6">
        <Label htmlFor="setSize">한 세트에 보여줄 항목 수</Label>
        <Input
          id="setSize"
          type="number"
          min={2}
          max={8}
          value={setSize}
          onChange={(e) => setSetSize(Number(e.target.value))}
          className="w-24 mt-2 h-10 px-3.5"
        />
      </div>

      {/* 직군 항목 */}
      <div className="mb-6">
        <Label>응답자 직군 항목</Label>
        <form className="flex gap-2 mt-2 mb-2" onSubmit={(e) => {
          e.preventDefault();
          if (!newRole.trim()) return;
          if (!jobRoles.includes(newRole.trim())) {
            setJobRoles([...jobRoles, newRole.trim()]);
          }
          setNewRole("");
        }}>
          <Input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="직군 이름 (예: 디자이너)"
            className="h-10 px-3.5"
          />
          <Button
            type="submit"
            variant="outline"
            className="h-10 px-3.5"
          >
            추가
          </Button>
        </form>
        {jobRoles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {jobRoles.map((role) => (
              <Badge
                key={role}
                variant="secondary"
                className="gap-1 h-6"
              >
                {role}
                <button
                  onClick={() => setJobRoles(jobRoles.filter((r) => r !== role))}
                  className="ml-0.5 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
        {jobRoles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            직군을 추가하지 않으면 설문 시작 시 직군 선택 단계가 생략됩니다.
          </p>
        )}
      </div>

      {/* 항목 추가 */}
      <div className="mb-6">
        <Label>평가 항목 추가</Label>
        <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
          <Input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="항목 이름 (예: Button)"
            className="h-10 px-3.5"
          />
          <Button type="submit" variant="outline" className="h-10 px-3.5">
            추가
          </Button>
        </form>
      </div>

      {/* 항목 목록 */}
      {items.length > 0 && (
        <div className="mb-8 space-y-3">
          <p className="text-sm font-medium text-foreground">
            항목 목록 ({items.length}개)
          </p>
          {items.map((item) => (
            <Card key={item.id} className="h-24">
              <CardContent className="flex items-center gap-4 p-4 h-full">
                {/* 이미지 미리보기 / 업로드 */}
                <div className="w-16 h-16 flex-shrink-0 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <label className="cursor-pointer text-muted-foreground text-xs text-center hover:text-muted-foreground">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(item.id, file);
                        }}
                      />
                      {uploading ? "..." : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>}
                    </label>
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.image && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-auto p-0"
                      onClick={() =>
                        setItems(
                          items.map((i) =>
                            i.id === item.id ? { ...i, image: undefined } : i
                          )
                        )
                      }
                    >
                      이미지 삭제
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive text-xl"
                  onClick={() => removeItem(item.id)}
                >
                  ×
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 생성 버튼 */}
      <Button
        onClick={createSurvey}
        disabled={creating}
        className="w-full h-10"
        size="lg"
      >
        {creating ? "생성 중..." : "설문 생성하기"}
      </Button>
    </div>
  );
}
