"use client";

import React, { useState, forwardRef, useImperativeHandle } from "react";
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
  TextButton,
  TextField,
  Typography,
} from "@wanteddev/wds";
import {
  IconCaretDown,
  IconCircleCheckFill,
  IconCircleInfoFill,
  IconCirclePlusFill,
  IconClose,
  IconCopy,
  IconHandle,
  IconHandleDesktop,
  IconImage,
  IconListCategory,
  IconLineHorizontal,
  IconMoreVertical,
  IconTrash,
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
  bestLabel: string;
  worstLabel: string;
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

export interface SurveyFormRef {
  submit: (status: "published" | "draft", overrideTitle?: string) => Promise<void>;
  setTitle: (title: string) => void;
}

// ── 레이블 / 아이콘 ─────────────────────────────────────────────────

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

const ADD_OPTIONS: Exclude<Block["type"], "section">[] = [
  "maxdiff",
  "multiple_choice",
  "short_answer",
  "long_answer",
];

// ── 초기 블록 생성 헬퍼 ──────────────────────────────────────────────────────

function createBlock(type: Block["type"], order: number): Block {
  if (type === "maxdiff") {
    return { id: crypto.randomUUID(), type: "maxdiff", title: "", items: [], setSize: 4, bestLabel: "", worstLabel: "", order };
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
      bestLabel: "",
      worstLabel: "",
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
          multipleAnswers: q.multipleAnswers ?? false,
          order: blocks.length + i,
        });
      }
    });
  }
  return blocks;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

const SurveyForm = forwardRef<SurveyFormRef, SurveyFormProps>(function SurveyForm({ mode, initialData, surveyId }, ref) {
  const router = useRouter();

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

  useImperativeHandle(ref, () => ({
    submit: submitSurvey,
    setTitle,
  }));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── 블록 조작 ──────────────────────────────────────────────────────────────

  const addBlock = (type: Block["type"], afterId?: string) => {
    const newBlock = createBlock(type, blocks.length);
    // MaxDiff는 항상 개별 섹션으로 생성
    const sectionBlock = type === "maxdiff" ? createBlock("section", blocks.length) : null;
    setBlocks((prev) => {
      if (afterId) {
        const idx = prev.findIndex((b) => b.id === afterId);
        const next = [...prev];
        if (sectionBlock) {
          next.splice(idx + 1, 0, sectionBlock, newBlock);
        } else {
          next.splice(idx + 1, 0, newBlock);
        }
        return next.map((b, i) => ({ ...b, order: i }));
      }
      if (sectionBlock) {
        return [...prev, sectionBlock, newBlock];
      }
      return [...prev, newBlock];
    });
    setSelectedId(newBlock.id);
  };

  const duplicateBlock = (id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const dup = { ...JSON.parse(JSON.stringify(original)), id: crypto.randomUUID() };
      if (dup.type === "maxdiff") {
        dup.items = dup.items.map((i: ItemInput) => ({ ...i, id: crypto.randomUUID() }));
        // MaxDiff 복제 시 개별 섹션도 함께 생성
        const sectionBlock = createBlock("section", 0);
        const next = [...prev];
        next.splice(idx + 1, 0, sectionBlock, dup);
        return next.map((b, i) => ({ ...b, order: i }));
      }
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next.map((b, i) => ({ ...b, order: i }));
    });
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

  const duplicateSection = (sectionId: string) => {
    setBlocks((prev) => {
      const sectionIdx = prev.findIndex((b) => b.id === sectionId);
      if (sectionIdx === -1) return prev;
      // 섹션과 그 하위 블록들을 찾기
      const childBlocks: Block[] = [];
      for (let i = sectionIdx + 1; i < prev.length; i++) {
        if (prev[i].type === "section") break;
        childBlocks.push(prev[i]);
      }
      // 섹션 복제
      const dupSection = { ...JSON.parse(JSON.stringify(prev[sectionIdx])), id: crypto.randomUUID() };
      // 하위 블록들 복제
      const dupChildren = childBlocks.map((b) => {
        const dup = { ...JSON.parse(JSON.stringify(b)), id: crypto.randomUUID() };
        if (dup.type === "maxdiff") {
          dup.items = dup.items.map((i: ItemInput) => ({ ...i, id: crypto.randomUUID() }));
        }
        return dup;
      });
      const insertIdx = sectionIdx + 1 + childBlocks.length;
      const next = [...prev];
      next.splice(insertIdx, 0, dupSection, ...dupChildren);
      return next.map((b, i) => ({ ...b, order: i }));
    });
  };

  const removeSectionWithBlocks = (sectionId: string) => {
    setBlocks((prev) => {
      const sectionIdx = prev.findIndex((b) => b.id === sectionId);
      if (sectionIdx === -1) return prev;
      // 섹션과 그 하위 블록들의 ID 수집
      const idsToRemove = new Set<string>([sectionId]);
      for (let i = sectionIdx + 1; i < prev.length; i++) {
        if (prev[i].type === "section") break;
        idsToRemove.add(prev[i].id);
      }
      const filtered = prev.filter((b) => !idsToRemove.has(b.id)).map((b, i) => ({ ...b, order: i }));
      if (selectedId && idsToRemove.has(selectedId)) {
        setSelectedId(filtered[0]?.id ?? null);
      }
      return filtered;
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
    if (type === "maxdiff") {
      // MaxDiff로 변경 시 해당 블록 앞에 섹션 자동 삽입
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;
        const b = prev[idx];
        const maxdiffBlock: MaxDiffBlock = { id: b.id, type: "maxdiff", title: b.title, items: [], setSize: 4, bestLabel: "", worstLabel: "", order: b.order };
        // 바로 앞이 이미 섹션이면 추가하지 않음
        const prevBlock = idx > 0 ? prev[idx - 1] : null;
        if (prevBlock?.type === "section") {
          const next = [...prev];
          next[idx] = maxdiffBlock;
          return next.map((bl, i) => ({ ...bl, order: i }));
        }
        const sectionBlock = createBlock("section", 0);
        const next = [...prev];
        next.splice(idx, 1, sectionBlock, maxdiffBlock);
        return next.map((bl, i) => ({ ...bl, order: i }));
      });
      return;
    }
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
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

  const submitSurvey = async (status: "published" | "draft", overrideTitle?: string) => {
    const effectiveTitle = overrideTitle ?? title;
    if (!effectiveTitle.trim()) return alert("설문 제목을 입력해주세요.");
    if (overrideTitle !== undefined) setTitle(overrideTitle);
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
      const payload = { title: effectiveTitle, items, setSize, jobRoles: [], status, questions };
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

  // ── 섹션별로 블록 그룹화 ──────────────────────────────────────────────────

  const sectionGroups: { section: SectionBlock | null; blocks: Block[] }[] = [];
  let currentGroup: { section: SectionBlock | null; blocks: Block[] } = { section: null, blocks: [] };

  blocks.forEach((block) => {
    if (block.type === "section") {
      if (currentGroup.blocks.length > 0 || currentGroup.section) {
        sectionGroups.push(currentGroup);
      }
      currentGroup = { section: block, blocks: [] };
    } else {
      currentGroup.blocks.push(block);
    }
  });
  sectionGroups.push(currentGroup);

  let questionCounter = 0;

  // ── 렌더링 ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "24px 20px 80px",
        }}
      >
        <div style={{ maxWidth: "780px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {sectionGroups.map((group, gi) => (
                <div key={gi} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* 섹션 헤더 */}
                  {(group.section || gi === 0) && (
                    <SectionHeader
                      section={group.section}
                      index={gi}
                      onRemove={removeSectionWithBlocks}
                      onDuplicate={duplicateSection}
                    />
                  )}

                  {/* 문항 카드들 */}
                  {group.blocks.map((block) => {
                    questionCounter++;
                    const isSelected = selectedId === block.id;
                    return (
                      <div key={block.id} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <SortableQuestionCard
                          block={block}
                          questionNumber={questionCounter}
                          selected={isSelected}
                          uploading={uploading}
                          onSelect={() => setSelectedId(block.id)}
                          onUpdate={updateBlock}
                          onChangeType={changeBlockType}
                          onRemove={removeBlock}
                          onDuplicate={duplicateBlock}
                          onAddItem={addItem}
                          onRemoveItem={removeItem}
                          onImageUpload={handleImageUpload}
                          onAddOption={addOption}
                          onUpdateOption={updateOption}
                          onRemoveOption={removeOption}
                        />
                        {isSelected && (
                          <AddQuestionRow
                            onAddBlock={(type) => addBlock(type, block.id)}
                            onAddSection={() => addBlock("section", block.id)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </SortableContext>
          </DndContext>

        </div>
      </div>
    </div>
  );
});

export default SurveyForm;

// ── 섹션 헤더 ────────────────────────────────────────────────────────────────

function SectionHeader({
  section,
  index,
  onRemove,
  onDuplicate,
}: {
  section: SectionBlock | null;
  index: number;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const sectionTitle = section?.title || `섹션 ${index + 1}`;

  return (
    <FlexBox alignItems="center" gap="8px" sx={{ padding: "6px 0" }}>
      <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
      {section ? (
        <Menu value="" onValueChange={() => {}}>
          <MenuTrigger>
            <TextButton
              color="assistive"
              size="medium"
              trailingContent={<IconCaretDown />}
            >
              {sectionTitle}
            </TextButton>
          </MenuTrigger>
          <MenuContent disablePortal sx={{ borderRadius: "16px", minWidth: "unset" }}>
            <MenuList>
              <MenuItem value="duplicate" onClick={() => onDuplicate(section.id)}>
                <FlexBox alignItems="center" gap="8px">
                  <IconCopy sx={{ fontSize: "16px" }} />
                  <span>섹션 복제</span>
                </FlexBox>
              </MenuItem>
              <MenuItem value="delete" onClick={() => onRemove(section.id)}>
                <FlexBox alignItems="center" gap="8px">
                  <IconTrash sx={{ fontSize: "16px" }} />
                  <span>섹션 삭제</span>
                </FlexBox>
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      ) : (
        <TextButton color="assistive" size="medium">
          {sectionTitle}
        </TextButton>
      )}
      <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
    </FlexBox>
  );
}

// ── 질문 추가 행 ─────────────────────────────────────────────────────────────

function AddQuestionRow({ onAddBlock, onAddSection }: { onAddBlock: (type: Block["type"]) => void; onAddSection: () => void }) {
  return (
    <FlexBox alignItems="center" gap="8px" justifyContent="center" sx={{ padding: "8px 0" }}>
      <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
      <Box
        sx={(theme) => ({
          backgroundColor: "white",
          border: `1px solid ${theme.semantic.line.solid.neutral}`,
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "6px 14px",
          flexShrink: 0,
        })}
      >
        <Menu value="" onValueChange={() => {}}>
          <MenuTrigger>
            <TextButton color="primary" size="small">
              문항 추가
            </TextButton>
          </MenuTrigger>
          <MenuContent disablePortal sx={{ borderRadius: "16px", minWidth: "unset" }}>
            <MenuList>
              {ADD_OPTIONS.map((type) => (
                <MenuItem
                  key={type}
                  value={type}
                  verticalPadding="small"
                  onClick={() => onAddBlock(type)}
                  leadingContent={BLOCK_TYPE_ICONS[type]}
                  sx={{ alignItems: "center" }}
                >
                  {BLOCK_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </MenuList>
          </MenuContent>
        </Menu>
        <Box
          sx={(theme) => ({
            width: "1px",
            height: "18px",
            backgroundColor: theme.semantic.line.solid.neutral,
          })}
        />
        <TextButton color="assistive" size="small" onClick={onAddSection}>
          섹션 추가
        </TextButton>
      </Box>
      <Box sx={(theme) => ({ flex: 1, height: "1px", backgroundColor: theme.semantic.line.normal.alternative })} />
    </FlexBox>
  );
}

// ── Sortable 카드 래퍼 ───────────────────────────────────────────────────────

function SortableQuestionCard(props: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <QuestionCard {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

// ── 문항 카드 ────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  block: Block;
  questionNumber: number;
  selected: boolean;
  uploading: string | null;
  onSelect: () => void;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onChangeType: (id: string, type: Block["type"]) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddItem: (blockId: string, name: string) => void;
  onRemoveItem: (blockId: string, itemId: string) => void;
  onImageUpload: (blockId: string, itemId: string, file: File) => void;
  onAddOption: (blockId: string) => void;
  onUpdateOption: (blockId: string, idx: number, value: string) => void;
  onRemoveOption: (blockId: string, idx: number) => void;
}

function QuestionCard({
  block,
  selected,
  uploading,
  onSelect,
  onUpdate,
  onChangeType,
  onRemove,
  onDuplicate,
  onAddItem,
  onRemoveItem,
  onImageUpload,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  dragAttributes,
  dragListeners,
}: QuestionCardProps & {
  dragAttributes?: ReturnType<typeof useSortable>["attributes"];
  dragListeners?: ReturnType<typeof useSortable>["listeners"];
}) {
  if (block.type === "section") return null;

  return (
    <Box
      onClick={onSelect}
      sx={(theme) => ({
        borderRadius: "20px",
        overflow: "hidden",
        border: selected
          ? `1px solid #9EC5FF`
          : `1px solid ${theme.semantic.line.solid.neutral}`,
        boxShadow: selected ? "0 0 0 4px rgba(0,102,255,0.12)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        cursor: "default",
      })}
    >
      {/* 상단 콘텐츠 영역 */}
      <div style={{ backgroundColor: "white", padding: "12px 24px 32px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>
        {/* 드래그 핸들 */}
        <div
          {...dragAttributes}
          {...dragListeners}
          style={{ cursor: "grab", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <IconHandle
            sx={(theme) => ({
              fontSize: "20px",
              color: theme.semantic.label.alternative,
            })}
          />
        </div>

        {/* 제목 + 타입 셀렉트 */}
        <div style={{ width: "100%", display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <TextField
              value={block.title}
              onChange={(e) => onUpdate(block.id, { title: e.target.value })}
              placeholder="제목을 입력해 주세요."
              width="100%"
            />
          </div>
          <div style={{ width: "200px", flexShrink: 0 }}>
            <Select
              value={block.type}
              onChange={(value) => onChangeType(block.id, value as Block["type"])}
              width="100%"
              leadingContent={BLOCK_TYPE_ICONS[block.type]}
            >
              {ADD_OPTIONS.map((type) => (
                <Option key={type} value={type}>
                  {BLOCK_TYPE_LABELS[type]}
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div style={{ width: "100%", paddingLeft: "8px" }}>
          {/* 단답형 */}
          {block.type === "short_answer" && (
            <div style={{ borderBottom: "1px solid #E1E2E4", paddingBottom: "9px" }}>
              <Typography
                variant="body1"
                sx={() => ({
                  fontSize: "15px",
                  color: "rgba(55,56,60,0.28)",
                  lineHeight: "1.625",
                })}
              >
                단답형 답변
              </Typography>
            </div>
          )}

          {/* 장문형 */}
          {block.type === "long_answer" && (
            <div style={{ borderBottom: "1px solid #E1E2E4", paddingBottom: "9px" }}>
              <Typography
                variant="body1"
                sx={() => ({
                  fontSize: "15px",
                  color: "rgba(55,56,60,0.28)",
                  lineHeight: "1.625",
                })}
              >
                장문형 답변
              </Typography>
            </div>
          )}

          {/* 객관식 */}
          {block.type === "multiple_choice" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(block as GeneralBlock).options.map((opt, optIdx) => (
                <FlexBox
                  key={optIdx}
                  alignItems="center"
                  gap="12px"
                  sx={(theme) => ({
                    borderBottom: optIdx === 0 && selected
                      ? `1px solid #9EC5FF`
                      : `none`,
                    paddingBottom: "8px",
                    height: "35px",
                  })}
                >
                  <IconHandleDesktop
                    sx={(theme) => ({
                      fontSize: "16px",
                      color: theme.semantic.label.alternative,
                      cursor: "grab",
                    })}
                  />
                  {(block as GeneralBlock).multipleAnswers ? (
                    <div style={{ width: 24, height: 24, borderRadius: 4, border: "2px solid #D1D5DB", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #D1D5DB", flexShrink: 0 }} />
                  )}
                  <input
                    value={opt}
                    onChange={(e) => onUpdateOption(block.id, optIdx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={`옵션 ${optIdx + 1}`}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      fontSize: "15px",
                      color: opt ? "#171719" : "rgba(55,56,60,0.61)",
                      background: "transparent",
                      fontFamily: "inherit",
                      lineHeight: "1.625",
                    }}
                  />
                  {optIdx === 0 && selected && (
                    <IconButton
                      size={20}
                      sx={(theme) => ({ color: theme.semantic.label.alternative, marginRight: "2px" })}
                    >
                      <IconImage />
                    </IconButton>
                  )}
                  <IconButton
                    size={16}
                    onClick={(e) => { e.stopPropagation(); removeOption(block.id, optIdx); }}
                    disabled={(block as GeneralBlock).options.length <= 2}
                    sx={(theme) => ({
                      color: theme.semantic.label.alternative,
                      "&:hover": { color: theme.semantic.status.negative },
                    })}
                  >
                    <IconClose />
                  </IconButton>
                </FlexBox>
              ))}
              <TextButton
                color="assistive"
                size="medium"
                leadingContent={<IconCirclePlusFill />}
                onClick={(e) => { e.stopPropagation(); onAddOption(block.id); }}
              >
                옵션 추가
              </TextButton>
            </div>
          )}

          {/* MaxDiff */}
          {block.type === "maxdiff" && (
            <MaxDiffContent
              block={block as MaxDiffBlock}
              uploading={uploading}
              onUpdate={onUpdate}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onImageUpload={onImageUpload}
            />
          )}
        </div>
      </div>

      {/* 하단 옵션 바 */}
      <QuestionOptionsBar
        block={block}
        onUpdate={onUpdate}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
    </Box>
  );

  function addItem(blockId: string, name: string) {
    onAddItem(blockId, name);
  }

  function removeItem(blockId: string, itemId: string) {
    onRemoveItem(blockId, itemId);
  }

  function removeOption(blockId: string, idx: number) {
    onRemoveOption(blockId, idx);
  }
}

// ── MaxDiff 콘텐츠 ──────────────────────────────────────────────────────────

function MaxDiffContent({
  block,
  uploading,
  onUpdate,
  onAddItem,
  onRemoveItem,
  onImageUpload,
}: {
  block: MaxDiffBlock;
  uploading: string | null;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onAddItem: (blockId: string, name: string) => void;
  onRemoveItem: (blockId: string, itemId: string) => void;
  onImageUpload: (blockId: string, itemId: string, file: File) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 항목 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {block.items.map((item, idx) => (
          <FlexBox key={item.id} alignItems="center" gap="12px">
            <IconHandleDesktop
              sx={(theme) => ({
                fontSize: "16px",
                color: theme.semantic.label.alternative,
                cursor: "grab",
              })}
            />
            <Typography
              variant="body1"
              sx={() => ({
                fontSize: "15px",
                color: "rgba(55,56,60,0.61)",
                textAlign: "center",
                width: "24px",
                flexShrink: 0,
              })}
            >
              {idx + 1}
            </Typography>
            {/* 썸네일 */}
            <div
              style={{
                width: 80,
                height: 60,
                borderRadius: 12,
                overflow: "hidden",
                flexShrink: 0,
                backgroundColor: "#F3F4F6",
                border: "1px solid rgba(112,115,124,0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "8px",
              }}
            >
              {item.image ? (
                <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <label style={{ cursor: "pointer", color: "#9CA3AF", display: "flex" }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(block.id, item.id, f); }}
                  />
                  {uploading === item.id ? (
                    <span style={{ fontSize: "10px" }}>...</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  )}
                </label>
              )}
            </div>
            {/* 항목 이름 */}
            <input
              value={item.name}
              onChange={(e) =>
                onUpdate(block.id, {
                  items: block.items.map((i) =>
                    i.id === item.id ? { ...i, name: e.target.value } : i
                  ),
                } as Partial<MaxDiffBlock>)
              }
              onClick={(e) => e.stopPropagation()}
              placeholder={`옵션 ${idx + 1}`}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "15px",
                color: item.name ? "#171719" : "rgba(55,56,60,0.61)",
                background: "transparent",
                fontFamily: "inherit",
                lineHeight: "1.625",
              }}
            />
            <IconButton
              size={16}
              onClick={(e) => { e.stopPropagation(); onRemoveItem(block.id, item.id); }}
              sx={(theme) => ({
                color: theme.semantic.label.alternative,
                "&:hover": { color: theme.semantic.status.negative },
              })}
            >
              <IconClose />
            </IconButton>
          </FlexBox>
        ))}
      </div>

      {/* 항목 추가 */}
      <TextButton
        color="assistive"
        size="medium"
        leadingContent={<IconCirclePlusFill />}
        onClick={(e) => { e.stopPropagation(); onAddItem(block.id, `옵션 ${block.items.length + 1}`); }}
      >
        옵션 추가
      </TextButton>

      {/* 구분선 */}
      <Box sx={(theme) => ({ width: "100%", height: "1px", backgroundColor: theme.semantic.line.solid.normal })} />

      {/* Best / Worst 라벨 */}
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <TextField
            value={block.bestLabel}
            onChange={(e) => onUpdate(block.id, { bestLabel: e.target.value } as Partial<MaxDiffBlock>)}
            placeholder="Best 라벨"
            width="100%"
            leadingContent={
              <span style={{ fontSize: "16px" }}>👍</span>
            }
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div style={{ flex: 1 }}>
          <TextField
            value={block.worstLabel}
            onChange={(e) => onUpdate(block.id, { worstLabel: e.target.value } as Partial<MaxDiffBlock>)}
            placeholder="Worst 라벨"
            width="100%"
            leadingContent={
              <span style={{ fontSize: "16px" }}>👎</span>
            }
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* 세트 설정 */}
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <Typography
            variant="label1"
            weight="bold"
            sx={(theme) => ({
              color: "rgba(46,47,51,0.88)",
              display: "block",
              marginBottom: "8px",
            })}
          >
            세트 당 선택지 수
          </Typography>
          <TextField
            type="number"
            min={2}
            max={8}
            value={String(block.setSize)}
            onChange={(e) => onUpdate(block.id, { setSize: Number(e.target.value) } as Partial<MaxDiffBlock>)}
            width="100%"
            onClick={(e) => e.stopPropagation()}
          />
          <Typography
            variant="caption1"
            sx={() => ({
              color: "rgba(55,56,60,0.61)",
              display: "block",
              marginTop: "8px",
            })}
          >
            3-5개를 권장해요.
          </Typography>
        </div>
        <div style={{ flex: 1 }}>
          <Typography
            variant="label1"
            weight="bold"
            sx={() => ({
              color: "rgba(46,47,51,0.88)",
              display: "block",
              marginBottom: "8px",
            })}
          >
            참가자 당 세트 수
          </Typography>
          <TextField
            readOnly
            value={String(calculateSets(block.items.length, block.setSize))}
            width="100%"
          />
          <Typography
            variant="caption1"
            sx={() => ({
              color: "rgba(55,56,60,0.61)",
              display: "block",
              marginTop: "8px",
            })}
          >
            15-20개를 권장해요.
          </Typography>
        </div>
      </div>
    </div>
  );
}

function calculateSets(itemCount: number, setSize: number): number {
  if (itemCount < 2 || setSize < 2) return 0;
  const minExposure = 3;
  return Math.ceil((itemCount * minExposure) / setSize);
}

// ── 하단 옵션 바 ─────────────────────────────────────────────────────────────

function QuestionOptionsBar({
  block,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  block: Block;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (block.type === "section") return null;

  return (
    <Box
      sx={(theme) => ({
        backgroundColor: "white",
        borderTop: `1px solid ${theme.semantic.line.solid.neutral}`,
        padding: "25px 24px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "24px",
      })}
    >
      {/* MaxDiff 안내 텍스트 */}
      {block.type === "maxdiff" && (
        <FlexBox alignItems="center" gap="6px" sx={{ flex: 1 }}>
          <IconCircleInfoFill
            sx={() => ({
              fontSize: "16px",
              color: "rgba(55,56,60,0.61)",
            })}
          />
          <Typography
            variant="label1"
            weight="medium"
            sx={() => ({
              color: "rgba(55,56,60,0.61)",
            })}
          >
            MaxDiff 문항은 개별 섹션으로 생성됩니다.
          </Typography>
        </FlexBox>
      )}

      {/* 복수 응답 토글 (객관식만) */}
      {block.type === "multiple_choice" && (
        <FlexBox alignItems="center" gap="8px">
          <Typography
            variant="label2"
            weight="bold"
            sx={() => ({
              color: "rgba(55,56,60,0.61)",
            })}
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

      {/* 필수 문항 토글 */}
      {block.type !== "maxdiff" && (
        <FlexBox alignItems="center" gap="8px">
          <Typography
            variant="label2"
            weight="bold"
            sx={() => ({
              color: "rgba(55,56,60,0.61)",
            })}
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

      {block.type === "maxdiff" && (
        <FlexBox alignItems="center" gap="8px">
          <Typography
            variant="label2"
            weight="bold"
            sx={() => ({
              color: "rgba(55,56,60,0.61)",
            })}
          >
            필수 문항
          </Typography>
          <Switch
            size="small"
            checked={true}
            disabled
          />
        </FlexBox>
      )}

      {/* 구분선 */}
      <Box
        sx={(theme) => ({
          width: "1px",
          height: "20px",
          backgroundColor: theme.semantic.line.solid.normal,
        })}
      />

      {/* 액션 버튼 */}
      <FlexBox alignItems="center" gap="16px">
        <IconButton
          size={20}
          onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }}
          sx={(theme) => ({
            color: theme.semantic.label.alternative,
            "&:hover": { color: theme.semantic.label.normal },
          })}
        >
          <IconCopy />
        </IconButton>
        <IconButton
          size={20}
          onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
          sx={(theme) => ({
            color: theme.semantic.label.alternative,
            "&:hover": { color: theme.semantic.status.negative },
          })}
        >
          <IconTrash />
        </IconButton>
        <Menu value="" onValueChange={() => {}}>
          <MenuTrigger>
            <IconButton
              size={20}
              onClick={(e) => e.stopPropagation()}
              sx={(theme) => ({
                color: theme.semantic.label.alternative,
                "&:hover": { color: theme.semantic.label.normal },
              })}
            >
              <IconMoreVertical />
            </IconButton>
          </MenuTrigger>
          <MenuContent disablePortal sx={{ borderRadius: "16px", minWidth: "unset" }}>
            <MenuList>
              <MenuItem value="delete" onClick={() => onRemove(block.id)}>
                삭제
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      </FlexBox>
    </Box>
  );
}
