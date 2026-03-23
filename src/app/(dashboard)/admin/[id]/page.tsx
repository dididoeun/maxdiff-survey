"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import SurveyForm, { SurveyFormData } from "@/components/survey-form";
import {
  Avatar,
  AvatarButton,
  Box,
  Button,
  FlexBox,
  Loading,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuTrigger,
  SegmentedControl,
  SegmentedControlItem,
  TextButton,
  Typography,
} from "@wanteddev/wds";
import { IconChevronRightSmall, IconHomeFill } from "@wanteddev/wds-icon";

type EditorTab = "questions" | "responses" | "preview";

export default function EditSurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const { data: session, status } = useSession();

  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("questions");

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSurveyTitle(data.title || "설문 제목 없음");
        setSurveyData({
          title: data.title,
          items: data.items,
          setSize: data.setSize,
          jobRoles: data.jobRoles,
          status: data.status,
          questions: data.questions || [],
        });
      })
      .catch(() => setError("설문을 불러올 수 없습니다."));
  }, [surveyId]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div className="py-12 text-center">
          <Typography
            variant="body1"
            sx={(theme) => ({ color: theme.semantic.status.negative })}
          >
            {error}
          </Typography>
        </div>
      </div>
    );
  }

  if (!surveyData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
        <Loading variant="circular" size="20px" />
        <Typography
          variant="body1"
          sx={(theme) => ({ color: theme.semantic.label.alternative })}
        >
          설문을 불러오는 중...
        </Typography>
      </div>
    );
  }

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
          sx={{ padding: "0 20px", height: "100%", maxWidth: "1400px", margin: "0 auto", position: "relative" }}
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
              {surveyTitle}
            </Typography>
          </FlexBox>

          {/* Center: SegmentedControl */}
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            <SegmentedControl
              variant="solid"
              size="small"
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as EditorTab)}
              sx={{ width: "260px" }}
            >
              <SegmentedControlItem value="questions">문항</SegmentedControlItem>
              <SegmentedControlItem value="responses">응답</SegmentedControlItem>
              <SegmentedControlItem value="preview">미리보기</SegmentedControlItem>
            </SegmentedControl>
          </div>

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
        {activeTab === "questions" && (
          <div style={{ height: "100%" }}>
            <SurveyForm mode="edit" initialData={surveyData} surveyId={surveyId} />
          </div>
        )}
        {activeTab === "responses" && (
          <iframe
            src={`/dashboard/${surveyId}`}
            style={{
              width: "100%",
              height: "calc(100vh - 60px)",
              border: "none",
            }}
          />
        )}
        {activeTab === "preview" && (
          <iframe
            src={`/survey/${surveyId}`}
            style={{
              width: "100%",
              height: "calc(100vh - 60px)",
              border: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
