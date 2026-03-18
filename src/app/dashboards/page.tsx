"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Button, ContentBadge, FlexBox, IconButton, Typography } from "@wanteddev/wds";
import { IconEye, IconPencil, IconPlus, IconTrash } from "@wanteddev/wds-icon";
import { PageContent } from "@/components/page-content";

interface Survey {
  id: string;
  title: string;
  items: string;
  setSize: number;
  status: string;
  responseCount: number;
  createdAt: string;
}

export default function DashboardsPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys)
      .catch(() => {});
  }, []);

  return (
    <PageContent className="pt-[60px] pb-12">
      <FlexBox
        alignItems="center"
        justifyContent="space-between"
        sx={(theme) => ({
          paddingBottom: "20px",
          marginBottom: "20px",
          borderBottom: `1px solid ${theme.semantic.line.solid.normal}`,
        })}
      >
        <Typography
          variant="title3"
          weight="bold"
          sx={(theme) => ({ color: theme.semantic.label.normal })}
        >
          대시보드
        </Typography>
        <Button
          as={Link}
          href="/admin"
          variant="solid"
          color="primary"
          size="small"
          leadingContent={<IconPlus />}
        >
          설문 추가
        </Button>
      </FlexBox>

      {surveys.length === 0 ? (
        <Typography
          variant="body2"
          sx={(theme) => ({ color: theme.semantic.label.alternative })}
        >
          생성된 설문이 없습니다.
        </Typography>
      ) : (
        <div className="-mx-4">
          {surveys.map((s) => {
            const itemCount = JSON.parse(s.items).length;
            const hasResponses = Number(s.responseCount) > 0;
            const isDraft = s.status === "draft";
            return (
              <Box
                key={s.id}
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                  "&:hover": {
                    backgroundColor: theme.semantic.fill.normal,
                  },
                  "&:hover .action-buttons": {
                    opacity: 1,
                  },
                })}
                onClick={() => router.push(`/dashboard/${s.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <FlexBox alignItems="center" gap="6px">
                    <Typography
                      variant="body2"
                      weight="medium"
                      noWrap
                      sx={(theme) => ({ color: theme.semantic.label.normal })}
                    >
                      {s.title}
                    </Typography>
                    {isDraft && (
                      <ContentBadge color="neutral" size="xsmall" sx={{ flexShrink: 0 }}>
                        draft
                      </ContentBadge>
                    )}
                  </FlexBox>
                  <Typography
                    variant="caption1"
                    sx={(theme) => ({ color: theme.semantic.label.alternative, marginTop: "4px", display: "block" })}
                  >
                    항목 {itemCount}개 · 응답 {Number(s.responseCount)}건 · {s.createdAt.slice(0, 10).replace(/-/g, ".")}
                  </Typography>
                </div>

                <FlexBox
                  alignItems="center"
                  gap="4px"
                  sx={{ flexShrink: 0, marginLeft: "16px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FlexBox
                    className="action-buttons"
                    sx={{ opacity: 0, transition: "opacity 0.15s" }}
                  >
                    <IconButton
                      size={32}
                      title="삭제"
                      sx={(theme) => ({
                        color: theme.semantic.label.alternative,
                        "&:hover": { color: theme.semantic.status.negative },
                      })}
                      onClick={async () => {
                        if (!confirm("정말 이 설문을 삭제하시겠습니까?")) return;
                        const res = await fetch(`/api/surveys/${s.id}`, { method: "DELETE" });
                        if (res.ok) {
                          setSurveys(surveys.filter((sv) => sv.id !== s.id));
                        } else {
                          const data = await res.json();
                          alert(data.error || "삭제에 실패했습니다.");
                        }
                      }}
                    >
                      <IconTrash />
                    </IconButton>
                    {hasResponses ? (
                      <IconButton
                        size={32}
                        disabled
                        title="응답이 있는 설문은 수정할 수 없습니다"
                      >
                        <IconPencil />
                      </IconButton>
                    ) : (
                      <IconButton
                        as={Link}
                        href={`/admin/${s.id}`}
                        size={32}
                        title="수정"
                      >
                        <IconPencil />
                      </IconButton>
                    )}
                    <IconButton
                      as={Link}
                      href={`/survey/${s.id}`}
                      size={32}
                      title="미리보기"
                    >
                      <IconEye />
                    </IconButton>
                  </FlexBox>
                  <div className="ml-2">
                    <Button
                      as={Link}
                      href={`/dashboard/${s.id}`}
                      variant="outlined"
                      color="assistive"
                      size="small"
                    >
                      응답보기
                    </Button>
                  </div>
                </FlexBox>
              </Box>
            );
          })}
        </div>
      )}
    </PageContent>
  );
}
