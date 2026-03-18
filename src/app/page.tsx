"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Button, FlexBox, Typography } from "@wanteddev/wds";
import { IconEye } from "@wanteddev/wds-icon";
import { PageContent } from "@/components/page-content";

interface Survey {
  id: string;
  title: string;
  items: string;
  setSize: number;
  createdAt: string;
}

export default function Home() {
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys)
      .catch(() => {});
  }, []);

  return (
    <PageContent className="pt-[60px] pb-12 text-center">
      <Typography
        variant="title1"
        weight="bold"
        sx={(theme) => ({ color: theme.semantic.label.normal, marginBottom: "8px", display: "block" })}
      >
        원티드 UX 리서치
      </Typography>
      <Typography
        variant="body1"
        sx={(theme) => ({ color: theme.semantic.label.alternative, display: "block" })}
      >
        UX 리서치를 위한 설문조사를 만들고 결과를 분석하세요.
      </Typography>

      <Button
        as={Link}
        href="/admin"
        variant="solid"
        color="assistive"
        size="large"
        sx={{ marginTop: "32px", marginBottom: "48px" }}
      >
        + 새 설문 만들기
      </Button>

      {surveys.length > 0 && (
        <div className="space-y-3">
          {surveys.map((s) => {
            const itemCount = JSON.parse(s.items).length;
            return (
              <Box
                key={s.id}
                sx={(theme) => ({
                  height: "80px",
                  border: `1px solid ${theme.semantic.line.solid.normal}`,
                  borderRadius: "8px",
                  padding: "0 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                })}
              >
                <div className="text-left">
                  <Typography
                    variant="body2"
                    weight="medium"
                    sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}
                  >
                    {s.title}
                  </Typography>
                  <Typography
                    variant="caption1"
                    sx={(theme) => ({ color: theme.semantic.label.alternative, marginTop: "2px", display: "block" })}
                  >
                    항목 {itemCount}개 · {s.createdAt}
                  </Typography>
                </div>
                <FlexBox gap="8px">
                  <Button
                    as={Link}
                    href={`/survey/${s.id}`}
                    variant="solid"
                    color="assistive"
                    iconOnly
                    size="small"
                    title="미리보기"
                  >
                    <IconEye />
                  </Button>
                  <Button
                    as={Link}
                    href={`/dashboard/${s.id}`}
                    variant="solid"
                    color="assistive"
                    size="small"
                  >
                    대시보드
                  </Button>
                </FlexBox>
              </Box>
            );
          })}
        </div>
      )}
    </PageContent>
  );
}
