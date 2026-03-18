"use client";

import { Grid, GridItem } from "@wanteddev/wds";

/**
 * WDS 12컬럼 그리드 기반 페이지 콘텐츠 래퍼
 * size="sm"  → max-w-lg 수준 (설문 응답 등 좁은 페이지)
 * size="md"  → max-w-3xl 수준 (대시보드, 폼 등 일반 페이지)
 */
export function PageContent({
  children,
  size = "md",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={className}>
      <Grid
        spacing={0}
        sx={{ paddingLeft: "16px", paddingRight: "16px" }}
      >
        <GridItem
          columns={12}
          md={size === "sm" ? { columns: 8, offset: 2 } : { columns: 10, offset: 1 }}
          lg={size === "sm" ? { columns: 6, offset: 3 } : { columns: 8, offset: 2 }}
        >
          {children}
        </GridItem>
      </Grid>
    </div>
  );
}
