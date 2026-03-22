"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Typography,
} from "@wanteddev/wds";
import { IconMoreHorizontal, IconPlus } from "@wanteddev/wds-icon";

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

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 설문을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSurveys(surveys.filter((s) => s.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "삭제에 실패했습니다.");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Column Header */}
      <FlexBox
        alignItems="center"
        gap="16px"
        sx={(theme) => ({
          paddingBottom: "12px",
          paddingLeft: "20px",
          paddingRight: "60px",
        })}
      >
        <Typography
          variant="label2"
          weight="medium"
          sx={(theme) => ({ color: theme.semantic.label.alternative, flex: 1 })}
        >
          제목
        </Typography>
        <Typography
          variant="label2"
          weight="medium"
          sx={(theme) => ({ color: theme.semantic.label.alternative, width: "100px" })}
        >
          응답
        </Typography>
        <Typography
          variant="label2"
          weight="medium"
          sx={(theme) => ({ color: theme.semantic.label.alternative, width: "100px" })}
        >
          업데이트
        </Typography>
      </FlexBox>

      {/* Survey List */}
      <FlexBox flexDirection="column" gap="8px">
        {surveys.length === 0 ? (
          <FlexBox
            alignItems="center"
            justifyContent="center"
            sx={{ padding: "80px 0" }}
          >
            <div className="text-center">
              <Typography
                variant="body1"
                sx={(theme) => ({
                  color: theme.semantic.label.alternative,
                  display: "block",
                  marginBottom: "16px",
                })}
              >
                생성된 설문이 없습니다.
              </Typography>
              <Button
                as={Link}
                href="/admin"
                variant="solid"
                color="primary"
                size="small"
                leadingContent={<IconPlus />}
              >
                첫 설문 만들기
              </Button>
            </div>
          </FlexBox>
        ) : (
          surveys.map((s) => {
            const isDraft = s.status === "draft";
            const responseCount = Number(s.responseCount);
            const date = s.createdAt.slice(2, 10).replace(/-/g, ".");

            return (
              <Box
                key={s.id}
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "17px 21px",
                  border: `1px solid ${theme.semantic.line.solid.normal}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                  "&:hover": {
                    backgroundColor: theme.semantic.fill.normal,
                  },
                })}
                onClick={() => router.push(`/admin/${s.id}`)}
              >
                {/* 제목 */}
                <FlexBox
                  alignItems="center"
                  gap="8px"
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  <Typography
                    variant="body2"
                    weight="medium"
                    noWrap
                    sx={(theme) => ({ color: theme.semantic.label.normal })}
                  >
                    {s.title}
                  </Typography>
                  {isDraft && (
                    <ContentBadge
                      color="neutral"
                      size="xsmall"
                      variant="solid"
                      sx={{ flexShrink: 0 }}
                    >
                      draft
                    </ContentBadge>
                  )}
                </FlexBox>

                {/* 응답 */}
                <Typography
                  variant="label2"
                  weight="medium"
                  sx={(theme) => ({
                    color: responseCount > 0
                      ? theme.semantic.label.neutral
                      : theme.semantic.label.assistive,
                    width: "100px",
                    flexShrink: 0,
                  })}
                >
                  {responseCount > 0 ? `${responseCount}건` : "-"}
                </Typography>

                {/* 업데이트 */}
                <Typography
                  variant="label2"
                  weight="medium"
                  sx={(theme) => ({
                    color: theme.semantic.label.neutral,
                    width: "100px",
                    flexShrink: 0,
                  })}
                >
                  {date}
                </Typography>

                {/* 더보기 메뉴 */}
                <div onClick={(e) => e.stopPropagation()}>
                  <Menu value="" onValueChange={() => {}}>
                    <MenuTrigger>
                      <IconButton variant="normal">
                        <IconMoreHorizontal />
                      </IconButton>
                    </MenuTrigger>
                    <MenuContent position="bottom-end" sx={{ minWidth: "140px", width: "140px" }}>
                      <MenuList>
                        <MenuItem
                          value="preview"
                          verticalPadding="small"
                          onClick={() => {
                            window.open(`/survey/${s.id}`, "_blank");
                          }}
                        >
                          미리보기
                        </MenuItem>
                        <MenuItem
                          value="duplicate"
                          verticalPadding="small"
                          onClick={() => {
                            // TODO: 복제 기능
                          }}
                        >
                          복제
                        </MenuItem>
                        <MenuItem
                          value="delete"
                          verticalPadding="small"
                          onClick={() => handleDelete(s.id)}
                          textProps={{
                            sx: (theme) => ({
                              color: theme.semantic.status.negative,
                            }),
                          }}
                        >
                          삭제
                        </MenuItem>
                      </MenuList>
                    </MenuContent>
                  </Menu>
                </div>
              </Box>
            );
          })
        )}
      </FlexBox>
    </div>
  );
}
