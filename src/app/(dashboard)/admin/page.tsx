"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import SurveyForm from "@/components/survey-form";
import {
  Avatar,
  AvatarButton,
  Box,
  Button,
  FlexBox,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuTrigger,
  TextButton,
  Typography,
} from "@wanteddev/wds";
import { IconChevronRightSmall, IconHomeFill } from "@wanteddev/wds-icon";

export default function AdminPage() {
  const { data: session, status } = useSession();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Editor GNB */}
      <Box
        as="header"
        sx={() => ({
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(32px)",
          backgroundColor: "rgba(255, 255, 255, 0.88)",
          height: "60px",
          flexShrink: 0,
        })}
      >
        <FlexBox
          alignItems="center"
          justifyContent="space-between"
          sx={{ padding: "0 20px", height: "100%", position: "relative" }}
        >
          {/* Leading: Breadcrumb */}
          <FlexBox alignItems="center" gap="6px">
            <TextButton
              as={Link}
              href="/dashboards"
              leadingContent={<IconHomeFill />}
              color="assistive"
              size="medium"
            >
              전체
            </TextButton>
            <IconChevronRightSmall
              sx={(theme) => ({
                fontSize: "16px",
                color: theme.semantic.label.alternative,
              })}
            />
            <Typography
              variant="body1"
              weight="bold"
              sx={(theme) => ({ color: theme.semantic.label.alternative })}
            >
              새 설문
            </Typography>
          </FlexBox>

          {/* Trailing: Actions */}
          <FlexBox alignItems="center" gap="16px">
            <FlexBox alignItems="center" gap="10px">
              <FlexBox alignItems="center" gap="8px">
                <Button variant="outlined" color="assistive" size="small">
                  공유
                </Button>
                <Button variant="outlined" color="assistive" size="small">
                  임시저장
                </Button>
              </FlexBox>
              <Box
                sx={(theme) => ({
                  width: "1px",
                  height: "20px",
                  backgroundColor: theme.semantic.line.solid.normal,
                })}
              />
              <Button variant="solid" color="primary" size="small">
                발행하기
              </Button>
            </FlexBox>
            {status === "loading" ? null : session?.user ? (
              <Menu>
                <MenuTrigger>
                  <AvatarButton>
                    <Avatar
                      size="xsmall"
                      variant="person"
                      src={session.user.image || undefined}
                    />
                  </AvatarButton>
                </MenuTrigger>
                <MenuContent position="bottom-end">
                  <MenuList>
                    <MenuItem value="logout" onClick={() => signOut()}>
                      로그아웃
                    </MenuItem>
                  </MenuList>
                </MenuContent>
              </Menu>
            ) : null}
          </FlexBox>
        </FlexBox>
      </Box>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SurveyForm mode="create" />
      </div>
    </div>
  );
}
