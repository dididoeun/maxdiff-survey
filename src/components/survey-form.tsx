"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  ContentBadge,
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
  IconCircleCheckFill,
  IconCirclePlusFill,
  IconClose,
  IconEye,
  IconHandle,
  IconHandleDesktop,
  IconLike,
  IconLineHorizontal,
  IconListCategory,
  IconPlus,
  IconVerifiedStarFill,
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
  maxdiff:         <IconVerifiedStarFill />,
  multiple_choice: <IconCircleCheckFill />,
  short_answer:    <IconHandle />,
  long_answer:     <IconListCategory />,
  section:         <IconLineHorizontal />,
};

const BLOCK_TYPE_STYLE: Record<Block["type"], { bg: string; color: string }> = {
  maxdiff:         { bg: "#EFF6FF", color: "#3B82F6" },
  multiple_choice: { bg: "#F5F3FF", color: "#8B5CF6" },
  short_answer:    { bg: "#FFFBEB", color: "#F59E0B" },
  long_answer:     { bg: "#ECFDF5", color: "#10B981" },
  section:         { bg: "#F9FAFB", color: "#9CA3AF" },
};

const BLOCK_TYPE_ACCENT_COLOR: Record<Block["type"], string> = {
  multiple_choice: "semantic.accent.foreground.cyan",
  short_answer:    "semantic.accent.foreground.violet",
  long_answer:     "semantic.accent.foreground.pink",
  maxdiff:         "semantic.accent.foreground.green",
  section:         "",
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── 3-패널 본문 ── */}
      <Box
        sx={(theme) => ({
          flex: 1,
          display: "flex",
          overflow: "hidden",
          gap: "20px",
          padding: "20px",
          maxWidth: "1400px",
          margin: "0 auto",
          width: "100%",
          backgroundColor: theme.semantic.background.normal.normal,
          minHeight: 0,
        })}
      >

        {/* ── LEFT: 문항 목록 사이드바 ── */}
        <Box
          sx={(theme) => ({
            width: "240px",
            flexShrink: 0,
            border: `1px solid ${theme.semantic.line.normal.alternative}`,
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backgroundColor: "#f7f7f8",
          })}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "12px", flex: 1, overflowY: "auto" }}>
            {/* 문항 목록 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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

              {/* 섹션 추가 + 문항 추가 */}
              <FlexBox alignItems="center" gap="8px" sx={{ padding: "8px 0" }}>
                <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
                <Button
                  variant="outlined"
                  color="assistive"
                  size="small"
                  onClick={() => addBlock("section")}
                  leadingContent={<IconCirclePlusFill />}
                  sx={(theme) => ({ backgroundColor: theme.semantic.background.normal.normal })}
                >
                  섹션
                </Button>
                <Menu value="" onValueChange={() => {}}>
                  <MenuTrigger>
                    <Button
                      variant="outlined"
                      color="assistive"
                      size="small"
                      leadingContent={<IconCirclePlusFill />}
                      sx={(theme) => ({ backgroundColor: theme.semantic.background.normal.normal })}
                    >
                      문항
                    </Button>
                  </MenuTrigger>
                  <MenuContent disablePortal sx={{ borderRadius: "16px", minWidth: "unset" }}>
                    <MenuList>
                      {ADD_OPTIONS.map((type) => (
                        <MenuItem
                          key={type}
                          value={type}
                          verticalPadding="small"
                          onClick={() => addBlock(type)}
                          leadingContent={BLOCK_TYPE_ICONS[type]}
                          sx={{ alignItems: "center" }}
                        >
                          {BLOCK_TYPE_LABELS[type]}
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuContent>
                </Menu>
                <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
              </FlexBox>
            </div>
          </div>
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
          {/* 에디터 콘텐츠 */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 0,
            }}
          >
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

        {/* ── RIGHT: 문항 설정 패널 ── */}
        <Box
          sx={(theme) => ({
            width: "240px",
            flexShrink: 0,
            border: `1px solid ${theme.semantic.line.normal.alternative}`,
            borderRadius: "16px",
            overflowY: "auto",
            backgroundColor: "#f7f7f8",
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
  const [hovered, setHovered] = useState(false);
  const isSection = block.type === "section";

  if (isSection) {
    return (
      <FlexBox
        alignItems="center"
        gap="8px"
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={(theme) => ({
          padding: "6px 0",
          cursor: "pointer",
        })}
      >
        <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
        <Typography
          variant="label2"
          weight="bold"
          sx={(theme) => ({
            color: theme.semantic.label.alternative,
            whiteSpace: "nowrap",
          })}
        >
          {block.title || "섹션"}
        </Typography>
        {hovered && (
          <Box
            as="button"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRemove(block.id); }}
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: theme.semantic.label.alternative,
              padding: 0,
              flexShrink: 0,
              "&:hover": { color: theme.semantic.status.negative },
            })}
          >
            <IconClose style={{ width: 14, height: 14 }} />
          </Box>
        )}
        <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
      </FlexBox>
    );
  }

  return (
    <Box
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 12px",
        cursor: "pointer",
        backgroundColor: selected
          ? theme.semantic.fill.normal
          : hovered
            ? theme.semantic.fill.alternative
            : "transparent",
        borderRadius: "12px",
        transition: "background-color 0.1s",
      })}
    >
      {/* 드래그 핸들 (hover 시) */}
      {hovered && !selected && (
        <div
          {...dragAttributes}
          {...dragListeners}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "grab", touchAction: "none", flexShrink: 0, display: "flex", height: 16 }}
        >
          <IconHandleDesktop sx={{ fontSize: "16px" }} />
        </div>
      )}

      {/* 타입 뱃지 */}
      <ContentBadge
        leadingContent={BLOCK_TYPE_ICONS[block.type]}
        color="accent"
        accentColor={BLOCK_TYPE_ACCENT_COLOR[block.type] as any}
        size="small"
        variant="solid"
      >
        {BLOCK_TYPE_LABELS[block.type]}
      </ContentBadge>

      {/* 제목 */}
      <Typography
        variant="label1"
        weight={selected ? "medium" : "regular"}
        noWrap
        sx={(theme) => ({
          flex: 1,
          minWidth: 0,
          color: theme.semantic.label.normal,
        })}
      >
        {block.title || "title"}
      </Typography>

      {/* 삭제 버튼 (hover 시) */}
      {hovered && (
        <div
          onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
          style={{ cursor: "pointer", flexShrink: 0, display: "flex", height: 16 }}
        >
          <IconClose sx={{ fontSize: "16px" }} />
        </div>
      )}
    </Box>
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
    <Box
      sx={(theme) => ({
        backgroundColor: "white",
        border: `1px solid ${theme.semantic.line.normal.normal}`,
        borderRadius: "12px",
        padding: "61px 81px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flex: 1,
        width: "100%",
        maxWidth: "640px",
      })}
    >
      {/* 문항 제목 */}
      <input
        value={block.title}
        onChange={(e) => onUpdate(block.id, { title: e.target.value })}
        placeholder="문항 제목"
        style={{
          border: "none",
          outline: "none",
          fontSize: "15px",
          fontWeight: 500,
          color: "#171719",
          background: "transparent",
          fontFamily: "inherit",
          lineHeight: "1.467",
          width: "100%",
        }}
      />

      {/* 답변 영역 */}
      {(block.type === "short_answer" || block.type === "long_answer") && (
        <div style={{ borderBottom: "1px solid #E1E2E4", paddingBottom: "9px" }}>
          {block.type === "long_answer" ? (
            <textarea
              disabled
              placeholder="답변"
              rows={3}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "16px",
                color: "rgba(55, 56, 60, 0.28)",
                background: "transparent",
                fontFamily: "inherit",
                lineHeight: "1.625",
                resize: "none",
                cursor: "default",
              }}
            />
          ) : (
            <input
              disabled
              placeholder="답변"
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "16px",
                color: "rgba(55, 56, 60, 0.28)",
                background: "transparent",
                fontFamily: "inherit",
                lineHeight: "1.625",
                cursor: "default",
              }}
            />
          )}
        </div>
      )}

      {/* 객관식 선택지 */}
      {block.type === "multiple_choice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                  flex: 1, border: "none", borderBottom: "1px solid #E1E2E4",
                  outline: "none", fontSize: "15px", color: "#171719",
                  background: "transparent", padding: "4px 0",
                  fontFamily: "inherit",
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
              color: "rgba(55, 56, 60, 0.28)", fontSize: "13px", textAlign: "left",
              padding: "4px 0", marginTop: "4px",
            }}
          >
            + 선택지 추가
          </button>
        </div>
      )}

      {/* MaxDiff 항목 목록 */}
      {block.type === "maxdiff" && (
        <div>
          {block.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {block.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    border: "1px solid #E1E2E4", borderRadius: "8px", padding: "8px 12px",
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
                  <span style={{ flex: 1, fontSize: "14px", color: "#171719" }}>{item.name}</span>
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
              <span style={{ fontSize: "12px", color: "rgba(55, 56, 60, 0.28)" }}>{block.items.length}개 항목</span>
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
            <Button type="submit" variant="outlined" color="primary" size="large" sx={{ flexShrink: 0 }}>
              추가
            </Button>
          </form>
        </div>
      )}
    </Box>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>
      {/* 답변 유형 Select */}
      {block.type !== "section" && (
        <Select
          value={block.type}
          onChange={(value) => onChangeType(block.id, value as Block["type"])}
          width="100%"
        >
          {ADD_OPTIONS.map((type) => (
            <Option key={type} value={type}>
              {BLOCK_TYPE_LABELS[type]}
            </Option>
          ))}
        </Select>
      )}

      {/* MaxDiff: 세트 크기 */}
      {block.type === "maxdiff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Typography
            variant="label2"
            weight="bold"
            sx={(theme) => ({ color: theme.semantic.label.alternative, paddingLeft: "8px" })}
          >
            세트당 항목 수
          </Typography>
          <TextField
            type="number"
            min={2}
            max={8}
            value={String(block.setSize)}
            onChange={(e) => onUpdate(block.id, { setSize: Number(e.target.value) } as Partial<MaxDiffBlock>)}
            width="100%"
          />
        </div>
      )}

      {/* 옵션 토글 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {/* 필수 문항 토글 */}
        {block.type !== "maxdiff" && block.type !== "section" && (
          <FlexBox
            alignItems="center"
            justifyContent="space-between"
            sx={{ padding: "8px 4px 8px 8px" }}
          >
            <Typography
              variant="label2"
              weight="bold"
              sx={(theme) => ({ color: theme.semantic.label.alternative })}
            >
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
            sx={{ padding: "8px 4px 8px 8px" }}
          >
            <Typography
              variant="label2"
              weight="bold"
              sx={(theme) => ({ color: theme.semantic.label.alternative })}
            >
              복수 응답
            </Typography>
            <Switch
              size="small"
              checked={(block as GeneralBlock).multipleAnswers ?? false}
              onCheckedChange={(checked) => onUpdate(block.id, { multipleAnswers: checked } as Partial<GeneralBlock>)}
            />
          </FlexBox>
        )}
      </div>
    </div>
  );
}
