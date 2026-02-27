"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ThumbsUp, CircleCheck, Equal, AlignJustify, ChevronDown, ChevronUp, GripVertical, SeparatorHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface ItemInput {
  id: string;
  name: string;
  image?: string;
}

interface MaxDiffBlock {
  id: string;
  type: "maxdiff";
  title: string;
  items: ItemInput[];
  setSize: number;
  order: number;
}

interface GeneralBlock {
  id: string;
  type: "multiple_choice" | "short_answer" | "long_answer";
  title: string;
  options: string[];
  required: boolean;
  order: number;
}

interface SectionBlock {
  id: string;
  type: "section";
  title: string;
  order: number;
}

type Block = MaxDiffBlock | GeneralBlock | SectionBlock;

export interface Question {
  id: string;
  type: "multiple_choice" | "short_answer" | "long_answer" | "section";
  title: string;
  options: string[];
  required: boolean;
  order: number;
}

export interface SurveyFormData {
  title: string;
  items: { name: string; image?: string }[];
  setSize: number;
  jobRoles: string[];
  status?: string;
  questions?: Question[];
}

interface SurveyFormProps {
  mode: "create" | "edit";
  initialData?: SurveyFormData;
  surveyId?: string;
}

// ── 레이블 ───────────────────────────────────────────────────────────────────

const BLOCK_TYPE_LABELS: Record<Block["type"], string> = {
  maxdiff: "MaxDiff 문항",
  multiple_choice: "객관식",
  short_answer: "단답형",
  long_answer: "장문형",
  section: "섹션",
};

const BLOCK_TYPE_ICONS: Record<Block["type"], React.ReactNode> = {
  maxdiff:         <ThumbsUp className="size-4" />,
  multiple_choice: <CircleCheck className="size-4" />,
  short_answer:    <Equal className="size-4" />,
  long_answer:     <AlignJustify className="size-4" />,
  section:         <SeparatorHorizontal className="size-4" />,
};

// 문항 추가 드롭다운 (섹션 제외)
const ADD_OPTIONS: Exclude<Block["type"], "section">[] = [
  "maxdiff",
  "multiple_choice",
  "short_answer",
  "long_answer",
];

// ── 초기 블록 생성 헬퍼 ──────────────────────────────────────────────────────

function createBlock(type: Block["type"], order: number): Block {
  if (type === "maxdiff") {
    return { id: crypto.randomUUID(), type: "maxdiff", title: "", items: [], setSize: 4, order };
  }
  if (type === "section") {
    return { id: crypto.randomUUID(), type: "section", title: "", order };
  }
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    options: type === "multiple_choice" ? ["", ""] : [],
    required: true,
    order,
  };
}

function initBlocks(initialData?: SurveyFormData): Block[] {
  const blocks: Block[] = [];

  // 생성 모드(초기 데이터 없음): 기본 객관식 문항 1개 추가
  if (!initialData) {
    blocks.push(createBlock("multiple_choice", 0));
    return blocks;
  }

  // MaxDiff 블록 (초기 데이터에 items가 있으면 복원)
  if (initialData && initialData.items.length > 0) {
    blocks.push({
      id: crypto.randomUUID(),
      type: "maxdiff",
      title: "",
      items: initialData.items.map((i) => ({ id: crypto.randomUUID(), ...i })),
      setSize: initialData.setSize || 4,
      order: 0,
    });
  }
  // 일반 문항 / 섹션 블록
  if (initialData?.questions) {
    initialData.questions.forEach((q, i) => {
      if (q.type === "section") {
        blocks.push({ id: q.id || crypto.randomUUID(), type: "section", title: q.title, order: blocks.length + i });
      } else {
        blocks.push({
          id: q.id || crypto.randomUUID(),
          type: q.type,
          title: q.title,
          options: q.options || [],
          required: q.required ?? true,
          order: blocks.length + i,
        });
      }
    });
  }
  return blocks;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function SurveyForm({ mode, initialData, surveyId }: SurveyFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || "");
  const [blocks, setBlocks] = useState<Block[]>(() => initBlocks(initialData));
  const [uploading, setUploading] = useState<string | null>(null); // blockId
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<"draft" | "published" | null>(null);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── 블록 조작 ──────────────────────────────────────────────────────────────

  const addBlock = (type: Block["type"]) => {
    setBlocks((prev) => [...prev, createBlock(type, prev.length)]);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) =>
      prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i }))
    );
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (dir === "up" && idx === 0) return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((b, i) => ({ ...b, order: i }));
    });
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
    });
  };

  const changeBlockType = (id: string, type: Block["type"]) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (type === "maxdiff") {
          const prevTitle = b.type !== "maxdiff" ? b.title : b.title;
          return { id: b.id, type: "maxdiff", title: prevTitle, items: [], setSize: 4, order: b.order };
        }
        if (type === "section") {
          return { id: b.id, type: "section", title: b.type !== "maxdiff" ? b.title : "", order: b.order };
        }
        const prevTitle = b.type !== "maxdiff" ? b.title : "";
        const prevRequired = b.type !== "maxdiff" && b.type !== "section" ? b.required : true;
        return {
          id: b.id,
          type,
          title: prevTitle,
          options: type === "multiple_choice" ? ["", ""] : [],
          required: prevRequired,
          order: b.order,
        };
      })
    );
  };

  // ── MaxDiff 블록 조작 ──────────────────────────────────────────────────────

  const addItem = (blockId: string, name: string) => {
    if (!name.trim()) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && b.type === "maxdiff"
          ? { ...b, items: [...b.items, { id: crypto.randomUUID(), name: name.trim() }] }
          : b
      )
    );
  };

  const removeItem = (blockId: string, itemId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && b.type === "maxdiff"
          ? { ...b, items: b.items.filter((i) => i.id !== itemId) }
          : b
      )
    );
  };

  const handleImageUpload = async (blockId: string, itemId: string, file: File) => {
    setUploading(itemId);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.path) {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId && b.type === "maxdiff"
              ? { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, image: data.path } : i)) }
              : b
          )
        );
      }
    } catch {
      alert("이미지 업로드에 실패했습니다.");
    }
    setUploading(null);
  };

  // ── 객관식 선택지 조작 ─────────────────────────────────────────────────────

  const addOption = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && b.type !== "maxdiff" && b.type !== "section"
          ? { ...b, options: [...b.options, ""] }
          : b
      )
    );
  };

  const updateOption = (blockId: string, idx: number, value: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && b.type !== "maxdiff" && b.type !== "section"
          ? { ...b, options: b.options.map((o: string, i: number) => (i === idx ? value : o)) }
          : b
      )
    );
  };

  const removeOption = (blockId: string, idx: number) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && b.type !== "maxdiff" && b.type !== "section" && b.options.length > 2
          ? { ...b, options: b.options.filter((_: string, i: number) => i !== idx) }
          : b
      )
    );
  };

  // ── 제출 ──────────────────────────────────────────────────────────────────

  const submitSurvey = async (status: "published" | "draft") => {
    if (!title.trim()) return alert("설문 제목을 입력해주세요.");

    const maxdiffBlock = blocks.find((b): b is MaxDiffBlock => b.type === "maxdiff");
    const items = maxdiffBlock?.items.map((i) => ({ name: i.name, image: i.image })) ?? [];
    const setSize = maxdiffBlock?.setSize ?? 4;

    if (status === "published" && items.length < 2) {
      return alert("발행하려면 MaxDiff 문항에 최소 2개 이상의 항목을 추가해주세요.");
    }

    const questions: Question[] = blocks
      .filter((b): b is GeneralBlock | SectionBlock => b.type !== "maxdiff")
      .map((b, i) => {
        if (b.type === "section") {
          return { id: b.id, type: "section" as const, title: b.title, options: [], required: false, order: i };
        }
        return { ...b, order: i };
      });

    setSavingType(status);
    try {
      const payload = { title, items, setSize, jobRoles: [], status, questions };

      if (mode === "edit" && surveyId) {
        const res = await fetch(`/api/surveys/${surveyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "설문 수정에 실패했습니다.");
          setSavingType(null);
          return;
        }
        status === "draft" ? router.push("/dashboards") : setCreatedId(surveyId);
      } else {
        const res = await fetch("/api/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.id) {
          status === "draft" ? router.push("/dashboards") : setCreatedId(data.id);
        }
      }
    } catch {
      alert("설문 저장에 실패했습니다.");
    }
    setSavingType(null);
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

  // ── 완료 화면 ─────────────────────────────────────────────────────────────

  if (createdId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <img src="/success.svg" alt="" className="mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-foreground">
          {mode === "edit" ? "설문을 수정했어요!" : "설문을 만들었어요!"}
        </h2>
        <p className="text-muted-foreground mt-1 mb-6">아래 URL을 응답자에게 공유하세요.</p>
        <div className="flex items-center gap-2 mb-6">
          <Input readOnly value={surveyUrl} className="h-10 px-3.5" />
          <Button variant="outline" onClick={copyUrl} className="whitespace-nowrap h-10 px-3.5">
            {copied ? "복사됨!" : "URL 복사"}
          </Button>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="secondary" onClick={() => router.push(`/survey/${createdId}`)}>
            설문 미리보기
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/dashboard/${createdId}`)}>
            대시보드 보기
          </Button>
        </div>
      </div>
    );
  }

  // ── 폼 ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Sticky 타이틀 바 */}
      <div className="sticky top-12 z-40 w-full bg-white border-b border-border pb-2">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">
            {mode === "edit" ? "설문 수정하기" : "새 설문 만들기"}
          </h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => submitSurvey("draft")}
              disabled={savingType !== null}
            >
              {savingType === "draft" ? "저장 중..." : "임시저장"}
            </Button>
            <Button
              onClick={() => submitSurvey("published")}
              disabled={savingType !== null}
            >
              {savingType === "published" ? "저장 중..." : "설문 생성하기"}
            </Button>
          </div>
        </div>
      </div>

    <div className="min-h-screen bg-white">
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 설문 제목 */}
      <div className="mb-8">
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="설문 제목을 입력해 주세요."
          className="h-10 px-3.5"
        />
      </div>

      {/* 문항 블록 목록 */}
      {blocks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 mb-6">
              {(() => {
                let sectionCount = 0;
                return blocks.map((block, idx) => {
                  if (block.type === "section") sectionCount++;
                  return (
                    <SortableBlockCard
                      key={block.id}
                      block={block}
                      idx={idx}
                      totalBlocks={blocks.length}
                      uploading={uploading}
                      isFocused={focusedId === block.id}
                      onFocus={setFocusedId}
                      sectionNumber={block.type === "section" ? sectionCount : undefined}
                      onMove={moveBlock}
                      onRemove={removeBlock}
                      onUpdate={updateBlock}
                      onChangeType={changeBlockType}
                      onAddItem={addItem}
                      onRemoveItem={removeItem}
                      onImageUpload={handleImageUpload}
                      onAddOption={addOption}
                      onUpdateOption={updateOption}
                      onRemoveOption={removeOption}
                    />
                  );
                });
              })()}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 문항/섹션 추가 */}
      <div className="flex gap-2 mb-10 justify-center">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => addBlock("section")}
          className="whitespace-nowrap hover:bg-neutral-200"
        >
          섹션 추가
        </Button>
        <div className="w-px h-3.5 bg-border self-center" />
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "hover:bg-neutral-200"
            )}
          >
            문항 추가
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ADD_OPTIONS.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => addBlock(type)}
                className="h-8 gap-2 cursor-pointer"
              >
                {BLOCK_TYPE_ICONS[type]}
                {BLOCK_TYPE_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
    </div>
    </>
  );
}

// ── Sortable 래퍼 ─────────────────────────────────────────────────────────────

function SortableBlockCard(props: BlockCardProps) {
  const isSection = props.block.type === "section";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.block.id, disabled: isSection });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("group/sortable relative", isDragging && "opacity-50")}>
      {!isSection && (
        <div
          className="absolute -left-6 top-3 opacity-0 group-hover/sortable:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4 text-muted-foreground" />
        </div>
      )}
      <BlockCard {...props} />
    </div>
  );
}

// ── 블록 카드 컴포넌트 ────────────────────────────────────────────────────────

interface BlockCardProps {
  block: Block;
  idx: number;
  totalBlocks: number;
  uploading: string | null;
  isFocused: boolean;
  onFocus: (id: string) => void;
  sectionNumber?: number;
  onMove: (id: string, dir: "up" | "down") => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onChangeType: (id: string, type: Block["type"]) => void;
  onAddItem: (blockId: string, name: string) => void;
  onRemoveItem: (blockId: string, itemId: string) => void;
  onImageUpload: (blockId: string, itemId: string, file: File) => void;
  onAddOption: (blockId: string) => void;
  onUpdateOption: (blockId: string, idx: number, value: string) => void;
  onRemoveOption: (blockId: string, idx: number) => void;
}

function SectionTitleButton({
  block, sectionNumber, onUpdate,
}: { block: SectionBlock; sectionNumber: number; onUpdate: (id: string, patch: Partial<Block>) => void }) {
  const [editing, setEditing] = useState(false);
  const displayText = block.title.trim() || `Section ${sectionNumber}`;

  if (editing) {
    return (
      <input
        autoFocus
        value={block.title}
        onChange={(e) => onUpdate(block.id, { title: e.target.value } as Partial<SectionBlock>)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
        placeholder={`Section ${sectionNumber}`}
        className="w-28 h-6 text-xs text-center bg-transparent border-b border-border outline-none px-1 text-foreground"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-muted-foreground font-medium whitespace-nowrap hover:text-foreground transition-colors px-2 shrink-0"
    >
      {displayText}
    </button>
  );
}

function BlockCard({
  block, idx, totalBlocks, uploading,
  isFocused, onFocus, sectionNumber,
  onMove, onRemove, onUpdate, onChangeType,
  onAddItem, onRemoveItem, onImageUpload,
  onAddOption, onUpdateOption, onRemoveOption,
}: BlockCardProps) {
  const [newItemName, setNewItemName] = useState("");

  // ── 섹션 카드 ────────────────────────────────────────────────────────────────
  if (block.type === "section") {
    return (
      <div className="flex items-center gap-2 h-10 w-full overflow-hidden">
        <div className="h-px bg-border flex-1 min-w-0" />
        <SectionTitleButton block={block} sectionNumber={sectionNumber ?? 1} onUpdate={onUpdate} />
        <div className="h-px bg-border flex-1 min-w-0" />
        <Button
          type="button" variant="ghost" size="icon"
          className="h-7 w-7 hover:text-destructive text-muted-foreground shrink-0"
          onClick={() => onRemove(block.id)}
        ><X className="size-3.5" /></Button>
      </div>
    );
  }

  return (
    <Card
      className={cn("border-border cursor-pointer transition-colors", isFocused && "border-gray-400 ring-2 ring-gray-300")}
      onClick={() => onFocus(block.id)}
    >
      <CardContent className="px-4 py-0 space-y-4">
        {/* 문항 제목 + 타입 뱃지 행 */}
        <div className="flex items-center gap-2">
          <Input
            value={block.title}
            onChange={(e) => onUpdate(block.id, { title: e.target.value })}
            placeholder="문항 제목"
            className="flex-1 h-10 px-3 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
          <Select
            value={block.type}
            onValueChange={(value) => onChangeType(block.id, value as Block["type"])}
          >
            <SelectTrigger
              className="!h-10 w-fit shrink-0 text-sm bg-secondary border-0 shadow-none px-3.5"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-1.5">
                {BLOCK_TYPE_ICONS[block.type]}
                {BLOCK_TYPE_LABELS[block.type]}
              </span>
            </SelectTrigger>
            <SelectContent className="p-1">
              {ADD_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    {BLOCK_TYPE_ICONS[type]}
                    {BLOCK_TYPE_LABELS[type]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* MaxDiff 블록 */}
        {block.type === "maxdiff" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`setSize-${block.id}`} className="text-sm">한 세트에 보여줄 항목 수</Label>
              <Input
                id={`setSize-${block.id}`}
                type="number"
                min={2}
                max={8}
                value={block.setSize}
                onChange={(e) => onUpdate(block.id, { setSize: Number(e.target.value) } as Partial<MaxDiffBlock>)}
                className="w-20 h-8 px-2.5 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onAddItem(block.id, newItemName);
                setNewItemName("");
              }}
            >
              <Input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="항목 이름 (예: Button)"
                className="h-9 px-3 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
              <Button type="submit" variant="outline" className="h-9 px-3 text-sm shrink-0">
                항목 추가
              </Button>
            </form>

            {block.items.length > 0 && (
              <div className="space-y-2">
                {block.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="w-10 h-10 shrink-0 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <label className="cursor-pointer text-muted-foreground">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onImageUpload(block.id, item.id, file);
                            }}
                          />
                          {uploading === item.id ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          )}
                        </label>
                      )}
                    </div>
                    <span className="flex-1 text-sm text-foreground">{item.name}</span>
                    {item.image && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive px-1"
                        onClick={(e) => { e.stopPropagation(); onUpdate(block.id, { items: block.items.map((i) => i.id === item.id ? { ...i, image: undefined } : i) } as Partial<MaxDiffBlock>); }}>
                        이미지 삭제
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => { e.stopPropagation(); onRemoveItem(block.id, item.id); }}>×</Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{block.items.length}개 항목 추가됨</p>
              </div>
            )}
          </div>
        )}

        {/* 객관식 선택지 */}
        {block.type === "multiple_choice" && (
          <div className="space-y-2 pl-1">
            {block.options.map((opt, optIdx) => (
              <div key={optIdx} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{optIdx + 1}.</span>
                <Input
                  value={opt}
                  onChange={(e) => onUpdateOption(block.id, optIdx, e.target.value)}
                  placeholder={`선택지 ${optIdx + 1}`}
                  className="flex-1 h-8 px-2.5 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button type="button" variant="ghost" size="icon"
                  className="h-7 w-7 hover:text-destructive text-muted-foreground shrink-0"
                  onClick={(e) => { e.stopPropagation(); onRemoveOption(block.id, optIdx); }}
                  disabled={block.options.length <= 2}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm"
              className="h-7 text-xs text-muted-foreground pl-6"
              onClick={(e) => { e.stopPropagation(); onAddOption(block.id); }}>
              + 선택지 추가
            </Button>
          </div>
        )}

      </CardContent>

      {/* 카드 푸터 - 포커스 시에만 표시 */}
      {isFocused && (
        <div className="border-t border-border px-4 pt-4 pb-0 flex items-center">
          {block.type !== "maxdiff" && (
            <label
              className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Switch
                checked={block.required}
                onCheckedChange={(checked) =>
                  onUpdate(block.id, { required: checked } as Partial<GeneralBlock>)
                }
              />
              필수 문항
            </label>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
              disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onMove(block.id, "up"); }}>
              <ChevronUp className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
              disabled={idx === totalBlocks - 1} onClick={(e) => { e.stopPropagation(); onMove(block.id, "down"); }}>
              <ChevronDown className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
