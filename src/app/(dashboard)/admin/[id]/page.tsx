"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import SurveyForm, { SurveyFormData, SurveyFormRef } from "@/components/survey-form";
import {
  Avatar,
  AvatarButton,
  Box,
  Button,
  FlexBox,
  IconButton,
  Loading,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuTrigger,
  SegmentedControl,
  SegmentedControlItem,
  TextButton,
  TextField,
  Typography,
} from "@wanteddev/wds";
import { IconChevronRightSmall, IconClose, IconCopy, IconEye, IconHomeFill } from "@wanteddev/wds-icon";

type EditorTab = "questions" | "responses" | "settings";

interface AdminUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string;
  createdAt: string;
}

export default function EditSurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const { data: session, status } = useSession();

  const formRef = useRef<SurveyFormRef>(null);
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("questions");

  // 공동 관리자 상태
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const surveyUrl = typeof window !== "undefined" ? `${window.location.origin}/survey/${surveyId}` : "";

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

    // 공동 관리자 목록 로드
    fetch(`/api/surveys/${surveyId}/admins`)
      .then((r) => r.json())
      .then((data) => {
        if (data.admins) setAdmins(data.admins);
      })
      .catch(() => {});
  }, [surveyId]);

  const copyUrl = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addAdmin = async () => {
    if (!adminEmail.trim()) return;
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim() }),
      });
      const data = await res.json();
      if (data.error) { setAdminError(data.error); }
      else {
        setAdminEmail("");
        const updated = await fetch(`/api/surveys/${surveyId}/admins`).then((r) => r.json());
        if (updated.admins) setAdmins(updated.admins);
      }
    } catch { setAdminError("추가에 실패했습니다."); }
    finally { setAdminLoading(false); }
  };

  const removeAdmin = async (userId: string) => {
    try {
      await fetch(`/api/surveys/${surveyId}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setAdmins(admins.filter((a) => a.userId !== userId));
    } catch {}
  };

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
    <Box sx={(theme) => ({ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: theme.semantic.background.normal.alternative })}>
      {/* Editor GNB */}
      <Box
        as="header"
        sx={(theme) => ({
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: theme.semantic.background.normal.normal,
          borderBottom: `1px solid ${theme.semantic.line.solid.neutral}`,
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
            {editingTitle ? (
              <input
                autoFocus
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                onBlur={() => {
                  setEditingTitle(false);
                  if (surveyData) setSurveyData({ ...surveyData, title: surveyTitle });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditingTitle(false);
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  color: "inherit",
                  padding: "2px 4px",
                  borderRadius: "4px",
                  minWidth: "80px",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.12)",
                }}
              />
            ) : (
              <Typography
                variant="body1"
                weight="bold"
                sx={(theme) => ({
                  color: theme.semantic.label.alternative,
                  cursor: "pointer",
                  "&:hover": { opacity: 0.7 },
                })}
                onClick={() => setEditingTitle(true)}
              >
                {surveyTitle || "제목 없음"}
              </Typography>
            )}
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
              <SegmentedControlItem value="settings">설정</SegmentedControlItem>
            </SegmentedControl>
          </div>

          {/* Trailing: Actions */}
          <FlexBox alignItems="center" gap="16px">
            <FlexBox alignItems="center" gap="10px">
              <FlexBox alignItems="center" gap="8px">
                <Button variant="outlined" color="assistive" size="small" onClick={copyUrl}>
                  {copied ? "복사됨!" : "공유"}
                </Button>
                <Button variant="outlined" color="assistive" size="small" onClick={() => {
                  formRef.current?.submit("draft", surveyTitle);
                }}>
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
              <Button variant="solid" color="primary" size="small" onClick={() => {
                formRef.current?.submit("published", surveyTitle);
              }}>
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
            <SurveyForm ref={formRef} mode="edit" initialData={surveyData} surveyId={surveyId} />
          </div>
        )}
        {activeTab === "responses" && (
          <iframe
            src={`/dashboard/${surveyId}?embed=1`}
            style={{
              width: "100%",
              height: "calc(100vh - 60px)",
              border: "none",
            }}
          />
        )}
        {activeTab === "settings" && (
          <div style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 20px", overflowY: "auto", height: "calc(100vh - 60px)" }}>
            {/* 설문 URL */}
            <Box sx={{ marginBottom: "24px" }}>
              <Typography
                variant="body1"
                weight="bold"
                sx={(theme) => ({ color: theme.semantic.label.normal, marginBottom: "12px", display: "block" })}
              >
                설문 URL
              </Typography>
              <FlexBox alignItems="center" gap="8px">
                <TextField
                  readOnly
                  value={surveyUrl}
                  height="40px"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  color="assistive"
                  size="medium"
                  leadingContent={<IconCopy />}
                  onClick={copyUrl}
                >
                  {copied ? "복사됨!" : "URL 복사"}
                </Button>
              </FlexBox>
            </Box>

            {/* 공동 관리자 */}
            <div>
              <Typography
                variant="body1"
                weight="bold"
                sx={(theme) => ({ color: theme.semantic.label.normal, marginBottom: "12px", display: "block" })}
              >
                공동 관리자
              </Typography>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <form
                  style={{ display: "flex", gap: "8px" }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    addAdmin();
                  }}
                >
                  <TextField
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="초대할 이메일 주소"
                    height="40px"
                    sx={{ flex: 1 }}
                  />
                  <Button
                    type="submit"
                    size="medium"
                    disabled={adminLoading || !adminEmail.trim()}
                    loading={adminLoading}
                  >
                    추가
                  </Button>
                </form>
                {adminError && (
                  <Typography
                    variant="body2"
                    sx={(theme) => ({ color: theme.semantic.status.negative })}
                  >
                    {adminError}
                  </Typography>
                )}

                {admins.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={(theme) => ({ color: theme.semantic.label.alternative })}
                  >
                    공동 관리자가 없습니다. 이메일로 추가해주세요.
                  </Typography>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {admins.map((admin) => (
                      <FlexBox
                        key={admin.userId}
                        alignItems="center"
                        gap="12px"
                        sx={(theme) => ({
                          border: `1px solid ${theme.semantic.line.solid.normal}`,
                          borderRadius: "8px",
                          padding: "8px 12px",
                        })}
                      >
                        {admin.image ? (
                          <img
                            src={admin.image}
                            alt={admin.name}
                            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", backgroundColor: "#F3F4F6",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, fontSize: "12px", fontWeight: 500, color: "#9CA3AF",
                          }}>
                            {admin.name?.[0] || "?"}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            weight="medium"
                            noWrap
                            sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}
                          >
                            {admin.name}
                          </Typography>
                          <Typography
                            variant="caption1"
                            noWrap
                            sx={(theme) => ({ color: theme.semantic.label.alternative, display: "block" })}
                          >
                            {admin.email}
                          </Typography>
                        </div>
                        <IconButton
                          size={28}
                          sx={(theme) => ({
                            color: theme.semantic.label.alternative,
                            "&:hover": { color: theme.semantic.status.negative },
                          })}
                          onClick={() => removeAdmin(admin.userId)}
                        >
                          <IconClose />
                        </IconButton>
                      </FlexBox>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Box>
  );
}
