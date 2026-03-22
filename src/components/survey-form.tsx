"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  FlexBox,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuTrigger,
  Option,
  Select,
  Switch,
  TextField,
  Typography,
} from "@wanteddev/wds";
import {
  IconAlignJustify,
  IconCircleCheck,
  IconClose,
  IconEye,
  IconHandle,
  IconLike,
  IconLineHorizontal,
  IconPlus,
} from "@wanteddev/wds-icon";
import { PageContent } from "@/components/page-content";
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
  multipleAnswers?: boolean;
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
  multipleAnswers?: boolean;
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

// ── 레이블 / 아이콘 / 스타일 ─────────────────────────────────────────────────

const BLOCK_TYPE_LABELS: Record<Block["type"], string> = {
  maxdiff: "MaxDiff",
  multiple_choice: "객관식",
  short_answer: "단답형",
  long_answer: "장문형",
  section: "섹션",
};

const BLOCK_TYPE_ICONS: Record<Block["type"], React.ReactNode> = {
  maxdiff:         <IconLike />,
  multiple_choice: <IconCircleCheck />,
  short_answer:    <IconLineHorizontal />,
  long_answer:     <IconAlignJustify />,
  section:         <IconLineHorizontal />,
};

const BLOCK_TYPE_STYLE: Record<Block["type"], { bg: string; color: string }> = {
  maxdiff:         { bg: "#EFF6FF", color: "#3B82F6" },
  multiple_choice: { bg: "#F5F3FF", color: "#8B5CF6" },
  short_answer:    { bg: "#FFFBEB", color: "#F59E0B" },
  long_answer:     { bg: "#ECFDF5", color: "#10B981" },
  section:         { bg: "#F9FAFB", color: "#9CA3AF" },
};

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
    multipleAnswers: false,
    order,
  };
}

function initBlocks(initialData?: SurveyFormData): Block[] {
  const blocks: Block[] = [];
  if (!initialData) {
    blocks.push(createBlock("multiple_choice", 0));
    return blocks;
  }
  if (initialData.items.length > 0) {
    blocks.push({
      id: crypto.randomUUID(),
      type: "maxdiff",
      title: "",
      items: initialData.items.map((i) => ({ id: crypto.randomUUID(), ...i })),
      setSize: initialData.setSize || 4,
      order: 0,
    });
  }
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

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function SurveyForm({ mode, initialData, surveyId }: SurveyFormProps) {
  const router = useRouter();

  // 초기 blocks와 selectedId를 한 번에 계산해 UUID 불일치 방지
  const [initData] = useState(() => {
    const blocks = initBlocks(initialData);
    return { blocks, selectedId: blocks[0]?.id ?? null };
  });

  const [title, setTitle] = useState(initialData?.title || "");
  const [blocks, setBlocks] = useState<Block[]>(initData.blocks);
  const [selectedId, setSelectedId] = useState<string | null>(initData.selectedId);
  const [uploading, setUploading] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<"draft" | "published" | null>(null);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const selectedIdx = blocks.findIndex((b) => b.id === selectedId);

  // ── 블록 조작 ──────────────────────────────────────────────────────────────

  const addBlock = (type: Block["type"]) => {
    const newBlock = createBlock(type, blocks.length);
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i }));
      if (selectedId === id) {
        const removedIdx = prev.findIndex((b) => b.id === id);
        setSelectedId(filtered[Math.min(removedIdx, filtered.length - 1)]?.id ?? null);
      }
      return filtered;
    });
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
          return { id: b.id, type: "maxdiff", title: b.title, items: [], setSize: 4, order: b.order };
        }
        if (type === "section") {
          return { id: b.id, type: "section", title: b.type !== "maxdiff" ? b.title : "", order: b.order };
        }
        const prevTitle = b.type !== "maxdiff" ? b.title : "";
        const prevRequired = b.type !== "maxdiff" && b.type !== "section" ? b.required : true;
        return {
          id: b.id, type,
          title: prevTitle,
          options: type === "multiple_choice" ? ["", ""] : [],
          required: prevRequired,
          multipleAnswers: false,
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
        if (!res.ok) { alert(data.error || "설문 수정에 실패했습니다."); setSavingType(null); return; }
        status === "draft" ? router.push("/dashboards") : setCreatedId(surveyId);
      } else {
        const res = await fetch("/api/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.id) { status === "draft" ? router.push("/dashboards") : setCreatedId(data.id); }
      }
    } catch {
      alert("설문 저장에 실패했습니다.");
    }
    setSavingType(null);
  };

  const surveyUrl = createdId && typeof window !== "undefined"
    ? `${window.location.origin}/survey/${createdId}` : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 완료 화면 ─────────────────────────────────────────────────────────────

  if (createdId) {
    return (
      <PageContent className="py-12 text-center">
        <img src="/success.svg" alt="" className="mx-auto mb-4" />
        <Typography variant="title3" weight="bold" sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}>
          {mode === "edit" ? "설문을 수정했어요!" : "설문을 만들었어요!"}
        </Typography>
        <Typography variant="body2" sx={(theme) => ({ color: theme.semantic.label.alternative, display: "block", marginTop: "4px", marginBottom: "24px" })}>
          아래 URL을 응답자에게 공유하세요.
        </Typography>
        <FlexBox alignItems="center" gap="8px" sx={{ marginBottom: "24px" }}>
          <TextField readOnly value={surveyUrl} width="100%" />
          <Button variant="outlined" color="assistive" onClick={copyUrl} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
            {copied ? "복사됨!" : "URL 복사"}
          </Button>
        </FlexBox>
        <FlexBox gap="8px" justifyContent="center">
          <Button variant="outlined" color="assistive" onClick={() => router.push(`/survey/${createdId}`)}>설문 미리보기</Button>
          <Button variant="outlined" color="assistive" onClick={() => router.push(`/dashboard/${createdId}`)}>대시보드 보기</Button>
        </FlexBox>
      </PageContent>
    );
  }

  // ── 3-패널 에디터 ─────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>

      {/* ── 상단 헤더 ── */}
      <Box
        sx={(theme) => ({
          flexShrink: 0,
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "20px",
          paddingRight: "20px",
          backgroundColor: theme.semantic.background.normal.normal,
          borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
        })}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="설문 제목 없음"
          style={{
            border: "none",
            outline: "none",
            fontWeight: 600,
            fontSize: "14px",
            background: "transparent",
            color: "inherit",
            flex: 1,
            minWidth: 0,
            marginRight: "16px",
          }}
        />
        <FlexBox gap="8px" sx={{ flexShrink: 0 }}>
          <Button
            variant="solid"
            color="primary"
            size="small"
            disabled={savingType !== null}
            onClick={() => submitSurvey("published")}
          >
            {savingType === "published" ? "저장 중..." : "설문 생성하기"}
          </Button>
        </FlexBox>
      </Box>

      {/* ── 3-패널 본문 ── */}
      <Box
        sx={(theme) => ({
          flex: 1,
          display: "flex",
          overflow: "hidden",
          gap: "20px",
          padding: "20px",
          backgroundColor: theme.semantic.background.normal.normal,
        })}
      >

        {/* ── LEFT: 문항 목록 사이드바 ── */}
        <Box
          sx={(theme) => ({
            width: "240px",
            flexShrink: 0,
            border: `1px solid ${theme.semantic.line.normal.alternative}`,
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backgroundColor: theme.semantic.background.normal.alternative,
          })}
        >
          {/* 문항 목록 */}
          <div style={{ flex: 1, overflowY: "auto", paddingTop: "8px", paddingBottom: "8px" }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {(() => {
                  let qNum = 0;
                  return blocks.map((block) => {
                    if (block.type !== "section") qNum++;
                    return (
                      <SortableQuestionListItem
                        key={block.id}
                        block={block}
                        questionNumber={block.type !== "section" ? qNum : undefined}
                        selected={selectedId === block.id}
                        onSelect={() => setSelectedId(block.id)}
                        onRemove={removeBlock}
                      />
                    );
                  });
                })()}
              </SortableContext>
            </DndContext>
          </div>

          {/* 섹션 추가 */}
          <Box
            sx={(theme) => ({
              flexShrink: 0,
              padding: "8px 12px",
              borderTop: `1px solid ${theme.semantic.line.normal.alternative}`,
            })}
          >
            <Button
              variant="outlined"
              color="assistive"
              size="small"
              fullWidth
              leadingContent={<IconPlus />}
              onClick={() => addBlock("section")}
            >
              섹션 추가
            </Button>
          </Box>

        </Box>

        {/* ── CENTER: 문항 에디터 ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 툴바 래퍼 — 중앙 배치 */}
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 16px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid rgba(112,115,124,0.08)",
              borderRadius: "12px",
              overflow: "hidden",
            }}>
              {/* 왼쪽 섹션: 문항 추가 */}
              <Box
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  padding: "8px",
                  backgroundColor: theme.semantic.background.normal.alternative,
                  borderRight: "1px solid rgba(112,115,124,0.08)",
                })}
              >
                <Menu>
                  <MenuTrigger>
                    <Button
                      variant="solid"
                      color="primary"
                      size="small"
                      leadingContent={<IconPlus />}
                    >
                      문항 추가
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuList>
                      {ADD_OPTIONS.map((type) => (
                        <MenuItem key={type} value={type} onClick={() => addBlock(type)}>
                          <FlexBox alignItems="center" gap="8px">
                            <div style={{
                              width: 20, height: 20, borderRadius: 4,
                              backgroundColor: BLOCK_TYPE_STYLE[type].bg,
                              color: BLOCK_TYPE_STYLE[type].color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <div style={{ width: 12, height: 12 }}>{BLOCK_TYPE_ICONS[type]}</div>
                            </div>
                            {BLOCK_TYPE_LABELS[type]}
                          </FlexBox>
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuContent>
                </Menu>
              </Box>

              {/* 오른쪽 섹션: 미리보기 + 임시저장 */}
              <Box
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px",
                  backgroundColor: theme.semantic.background.normal.alternative,
                })}
              >
                <Button
                  variant="outlined"
                  color="assistive"
                  size="small"
                  disabled={!surveyId}
                  leadingContent={<IconEye />}
                  onClick={() => surveyId && window.open(`/survey/${surveyId}`, "_blank")}
                >
                  미리보기
                </Button>
                <Button
                  variant="outlined"
                  color="assistive"
                  size="small"
                  disabled={savingType !== null}
                  onClick={() => submitSurvey("draft")}
                >
                  {savingType === "draft" ? "저장 중..." : "임시저장"}
                </Button>
              </Box>
            </div>
          </div>

          {/* 에디터 콘텐츠 */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              justifyContent: "center",
              padding: "40px 32px",
            }}
          >
            <div style={{ width: "100%", maxWidth: "520px" }}>
<div style={{ border: "1px solid #E5E7EB", borderRadius: "20px", padding: "60px", opacity: 0.6 }}>
              {selectedBlock ? (
                <CenterEditor
                  block={selectedBlock}
                  idx={selectedIdx}
                  uploading={uploading}
                  onUpdate={updateBlock}
                  onAddItem={addItem}
                  onRemoveItem={removeItem}
                  onImageUpload={handleImageUpload}
                  onAddOption={addOption}
                  onUpdateOption={updateOption}
                  onRemoveOption={removeOption}
                />
              ) : (
                <FlexBox alignItems="center" justifyContent="center" sx={{ minHeight: "120px" }}>
                  <Typography variant="body2" sx={(theme) => ({ color: theme.semantic.label.alternative })}>
                    왼쪽에서 문항을 선택하거나 추가하세요
                  </Typography>
                </FlexBox>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: 문항 설정 패널 ── */}
        <Box
          sx={(theme) => ({
            width: "272px",
            flexShrink: 0,
            border: `1px solid ${theme.semantic.line.normal.alternative}`,
            borderRadius: "12px",
            overflowY: "auto",
            backgroundColor: theme.semantic.background.normal.alternative,
          })}
        >
          {selectedBlock ? (
            <RightSettings
              block={selectedBlock}
              idx={selectedIdx}
              totalBlocks={blocks.length}
              onUpdate={updateBlock}
              onChangeType={changeBlockType}
              onRemove={removeBlock}
              onMove={moveBlock}
            />
          ) : (
            <Box sx={{ padding: "20px" }}>
              <Typography variant="caption1" sx={(theme) => ({ color: theme.semantic.label.alternative })}>
                문항을 선택하면 설정이 표시됩니다.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </div>
  );
}

// ── LEFT 사이드바 아이템 ───────────────────────────────────────────────────────

interface QuestionListItemProps {
  block: Block;
  questionNumber?: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: (id: string) => void;
}

function SortableQuestionListItem(props: QuestionListItemProps) {
  const isSection = props.block.type === "section";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.block.id, disabled: isSection });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <QuestionListItem {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

function QuestionListItem({
  block,
  questionNumber,
  selected,
  onSelect,
  onRemove,
  dragAttributes,
  dragListeners,
}: QuestionListItemProps & {
  dragAttributes?: ReturnType<typeof useSortable>["attributes"];
  dragListeners?: ReturnType<typeof useSortable>["listeners"];
}) {
  const isSection = block.type === "section";
  const typeStyle = BLOCK_TYPE_STYLE[block.type];

  if (isSection) {
    return (
      <div
        onClick={onSelect}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          cursor: "pointer",
          backgroundColor: selected ? "#F3F4F6" : "transparent",
        }}
      >
        <div style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
        <Typography
          variant="caption1"
          sx={(theme) => ({
            color: theme.semantic.label.alternative,
            whiteSpace: "nowrap",
            fontSize: "11px",

          })}
        >
          {block.title || "섹션"}
        </Typography>
        <div style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 16, height: 16, border: "none", background: "none", cursor: "pointer",
            color: "#9CA3AF", padding: 0, flexShrink: 0,
          }}
        >
          <IconClose style={{ width: 10, height: 10 }} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 8px",
        margin: "2px 8px",
        cursor: "pointer",
        backgroundColor: selected ? "#EBEBEB" : "transparent",
        borderRadius: "8px",
        transition: "background-color 0.1s",
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#F5F5F5"; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
    >
      {/* 드래그 핸들 */}
      <div
        {...dragAttributes}
        {...dragListeners}
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: "grab", touchAction: "none", flexShrink: 0, color: "#C4C4C4", display: "flex", padding: "2px" }}
      >
        <IconHandle style={{ width: 10, height: 10 }} />
      </div>

      {/* 타입 뱃지 */}
      <div
        style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: typeStyle.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: typeStyle.color,
        }}
      >
        <div style={{ width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {BLOCK_TYPE_ICONS[block.type]}
        </div>
      </div>

      {/* 번호 */}
      <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151", flex: 1 }}>
        {questionNumber}
      </span>

      {/* 삭제 버튼 (선택 시만) */}
      {selected && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, border: "none", background: "none",
            cursor: "pointer", color: "#9CA3AF", padding: 0, flexShrink: 0, borderRadius: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; }}
        >
          <IconClose style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

// ── CENTER 에디터 ─────────────────────────────────────────────────────────────

interface CenterEditorProps {
  block: Block;
  idx: number;
  uploading: string | null;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onAddItem: (blockId: string, name: string) => void;
  onRemoveItem: (blockId: string, itemId: string) => void;
  onImageUpload: (blockId: string, itemId: string, file: File) => void;
  onAddOption: (blockId: string) => void;
  onUpdateOption: (blockId: string, idx: number, value: string) => void;
  onRemoveOption: (blockId: string, idx: number) => void;
}

function CenterEditor(props: CenterEditorProps) {
  const { block, idx, uploading, onUpdate, onAddItem, onRemoveItem, onImageUpload, onAddOption, onUpdateOption, onRemoveOption } = props;
  const [newItemName, setNewItemName] = useState("");

  if (block.type === "section") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
        <input
          value={block.title}
          onChange={(e) => onUpdate(block.id, { title: e.target.value } as Partial<SectionBlock>)}
          placeholder="섹션 제목"
          style={{
            border: "none", outline: "none", textAlign: "center",
            fontWeight: 600, fontSize: "13px", color: "#6B7280",
            background: "transparent",
          }}
        />
        <div style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
      </div>
    );
  }

  return (
    <div>
      {/* 문항 번호 + 질문 (Typeform 스타일: "Q{n} →" 프리픽스) */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "6px" }}>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#0066FF",
            flexShrink: 0,
            lineHeight: "1.6",
            paddingTop: "2px",
          }}
        >
          {idx + 1} →
        </span>
        <textarea
          value={block.title}
          onChange={(e) => onUpdate(block.id, { title: e.target.value })}
          placeholder="질문을 입력하세요"
          rows={2}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "18px",
            fontWeight: 400,
            color: "#111827",
            background: "transparent",
            resize: "none",
            lineHeight: "1.6",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* 설명 입력 */}
      <div style={{ paddingLeft: "34px", marginBottom: "32px" }}>
        <input
          placeholder="Description (optional)"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            fontSize: "14px",
            fontStyle: "italic",
            color: "#9CA3AF",
            background: "transparent",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* MaxDiff 항목 목록 */}
      {block.type === "maxdiff" && (
        <div style={{ paddingLeft: "34px" }}>
          {block.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {block.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    border: "1px solid #E5E7EB", borderRadius: "8px", padding: "8px 12px",
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 6, overflow: "hidden",
                      flexShrink: 0, backgroundColor: "#F3F4F6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <label style={{ cursor: "pointer", color: "#9CA3AF", display: "flex" }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          style={{ display: "none" }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(block.id, item.id, f); }}
                        />
                        {uploading === item.id ? (
                          <span style={{ fontSize: "10px" }}>...</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        )}
                      </label>
                    )}
                  </div>
                  <span style={{ flex: 1, fontSize: "14px", color: "#374151" }}>{item.name}</span>
                  {item.image && (
                    <button
                      onClick={() => onUpdate(block.id, { items: block.items.map((i) => i.id === item.id ? { ...i, image: undefined } : i) } as Partial<MaxDiffBlock>)}
                      style={{ fontSize: "11px", color: "#EF4444", border: "none", background: "none", cursor: "pointer", padding: "2px 6px" }}
                    >
                      삭제
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveItem(block.id, item.id)}
                    style={{ display: "flex", border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", padding: 2 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; }}
                  >
                    <IconClose style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
              <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{block.items.length}개 항목</span>
            </div>
          )}
          <form
            style={{ display: "flex", gap: "8px" }}
            onSubmit={(e) => {
              e.preventDefault();
              onAddItem(block.id, newItemName);
              setNewItemName("");
            }}
          >
            <TextField
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="항목 이름 입력 후 추가"
              width="100%"
            />
            <Button type="submit" variant="outlined" color="assistive" size="small" sx={{ flexShrink: 0 }}>
              추가
            </Button>
          </form>
        </div>
      )}

      {/* 객관식 선택지 */}
      {block.type === "multiple_choice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "34px" }}>
          {block.options.map((opt, optIdx) => (
            <div key={optIdx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {block.multipleAnswers ? (
                <div style={{ width: 16, height: 16, borderRadius: 3, border: "2px solid #D1D5DB", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #D1D5DB", flexShrink: 0 }} />
              )}
              <input
                value={opt}
                onChange={(e) => onUpdateOption(block.id, optIdx, e.target.value)}
                placeholder={`선택지 ${optIdx + 1}`}
                style={{
                  flex: 1, border: "none", borderBottom: "1px solid #E5E7EB",
                  outline: "none", fontSize: "14px", color: "#374151",
                  background: "transparent", padding: "4px 0",
                }}
              />
              <button
                disabled={block.options.length <= 2}
                onClick={() => onRemoveOption(block.id, optIdx)}
                style={{
                  display: "flex", border: "none", background: "none",
                  cursor: block.options.length > 2 ? "pointer" : "default",
                  color: "#D1D5DB", padding: 2,
                }}
                onMouseEnter={(e) => { if (block.options.length > 2) (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#D1D5DB"; }}
              >
                <IconClose style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
          <button
            onClick={() => onAddOption(block.id)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              color: "#6B7280", fontSize: "13px", textAlign: "left",
              padding: "4px 0", marginTop: "4px",
            }}
          >
            + 선택지 추가
          </button>
        </div>
      )}

      {/* 단답형 미리보기 */}
      {block.type === "short_answer" && (
        <div style={{ paddingLeft: "34px" }}>
          <input
            disabled
            placeholder="답변을 입력하세요..."
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #93C5FD",
              outline: "none",
              fontSize: "15px",
              color: "#93C5FD",
              background: "transparent",
              padding: "8px 0",
              fontFamily: "inherit",
              cursor: "default",
            }}
          />
        </div>
      )}

      {/* 장문형 미리보기 */}
      {block.type === "long_answer" && (
        <div style={{ paddingLeft: "34px" }}>
          <textarea
            disabled
            placeholder="답변을 입력하세요..."
            rows={3}
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #93C5FD",
              outline: "none",
              fontSize: "15px",
              color: "#93C5FD",
              background: "transparent",
              padding: "8px 0",
              fontFamily: "inherit",
              resize: "none",
              cursor: "default",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── RIGHT 설정 패널 ───────────────────────────────────────────────────────────

interface RightSettingsProps {
  block: Block;
  idx: number;
  totalBlocks: number;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onChangeType: (id: string, type: Block["type"]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
}

function RightSettings({ block, idx, totalBlocks, onUpdate, onChangeType, onRemove, onMove }: RightSettingsProps) {
  return (
    <div>
      {/* 헤더: "문항" */}
      <Box
        sx={(theme) => ({
          padding: "16px 20px",
          borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
        })}
      >
        <Typography
          variant="body2"
          weight="bold"
          sx={(theme) => ({ color: theme.semantic.label.normal })}
        >
          문항
        </Typography>
      </Box>

      {/* 답변 유형 섹션 */}
      {block.type !== "section" && (
        <Box
          sx={(theme) => ({
            padding: "16px 20px",
            borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
          })}
        >
            <Select
            value={block.type}
            onChange={(value) => onChangeType(block.id, value as Block["type"])}
            width="100%"
            render={(selected) => (
              <FlexBox alignItems="center" gap="8px">
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  backgroundColor: BLOCK_TYPE_STYLE[block.type].bg,
                  color: BLOCK_TYPE_STYLE[block.type].color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <div style={{ width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {BLOCK_TYPE_ICONS[block.type]}
                  </div>
                </div>
                <span style={{ fontSize: "14px" }}>{selected}</span>
              </FlexBox>
            )}
          >
            {ADD_OPTIONS.map((type) => (
              <Option key={type} value={type}>
                <FlexBox alignItems="center" gap="8px">
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    backgroundColor: BLOCK_TYPE_STYLE[type].bg,
                    color: BLOCK_TYPE_STYLE[type].color,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <div style={{ width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {BLOCK_TYPE_ICONS[type]}
                    </div>
                  </div>
                  {BLOCK_TYPE_LABELS[type]}
                </FlexBox>
              </Option>
            ))}
          </Select>
        </Box>
      )}

      {/* MaxDiff: 세트 크기 */}
      {block.type === "maxdiff" && (
        <Box
          sx={(theme) => ({
            padding: "16px 20px",
            borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
          })}
        >
          <Typography
            variant="caption1"
            sx={(theme) => ({ color: theme.semantic.label.alternative, display: "block", marginBottom: "8px" })}
          >
            세트당 항목 수
          </Typography>
          <TextField
            type="number"
            min={2}
            max={8}
            value={String(block.setSize)}
            onChange={(e) => onUpdate(block.id, { setSize: Number(e.target.value) } as Partial<MaxDiffBlock>)}
            width="80px"
          />
        </Box>
      )}

      {/* 필수 문항 토글 */}
      {block.type !== "maxdiff" && block.type !== "section" && (
        <FlexBox
          alignItems="center"
          justifyContent="space-between"
          sx={(theme) => ({
            padding: "14px 20px",
            borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
          })}
        >
          <Typography variant="body2" sx={(theme) => ({ color: theme.semantic.label.normal })}>
            필수 문항
          </Typography>
          <Switch
            size="small"
            checked={(block as GeneralBlock).required}
            onCheckedChange={(checked) => onUpdate(block.id, { required: checked } as Partial<GeneralBlock>)}
          />
        </FlexBox>
      )}

      {/* 복수 응답 토글 */}
      {block.type === "multiple_choice" && (
        <FlexBox
          alignItems="center"
          justifyContent="space-between"
          sx={(theme) => ({
            padding: "14px 20px",
            borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
          })}
        >
          <Typography variant="body2" sx={(theme) => ({ color: theme.semantic.label.normal })}>
            복수 응답
          </Typography>
          <Switch
            size="small"
            checked={(block as GeneralBlock).multipleAnswers ?? false}
            onCheckedChange={(checked) => onUpdate(block.id, { multipleAnswers: checked } as Partial<GeneralBlock>)}
          />
        </FlexBox>
      )}


      {/* 삭제 */}
      <Box sx={{ padding: "14px 20px", display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => onRemove(block.id)}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#FF4242",
            fontSize: "13px",
            fontFamily: "inherit",
            padding: "7px 14px",
            borderRadius: "8px",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFF1F1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
        >
          문항 삭제
        </button>
      </Box>
    </div>
  );
}
