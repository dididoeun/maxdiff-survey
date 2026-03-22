"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Box, FlexBox, Typography } from "@wanteddev/wds";
import { IconApps, IconPlus, IconLogout } from "@wanteddev/wds-icon";

const NAV_ITEMS = [
  { href: "/dashboards", label: "대시보드", icon: IconApps },
  { href: "/admin", label: "설문 생성", icon: IconPlus },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <Box
      as="aside"
      sx={(theme) => ({
        width: "240px",
        minWidth: "240px",
        height: "100vh",
        borderRight: `1px solid ${theme.semantic.line.solid.normal}`,
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.semantic.fill.normal,
        position: "sticky",
        top: 0,
      })}
    >
      {/* Logo */}
      <FlexBox
        alignItems="center"
        gap="10px"
        sx={{ padding: "20px 20px 16px" }}
      >
        <Link href="/dashboards" className="flex items-center gap-2.5 no-underline">
          <img src="/logo.svg" alt="홈" className="h-7 w-7" />
          <Typography
            variant="body1"
            weight="bold"
            sx={(theme) => ({ color: theme.semantic.label.normal })}
          >
            UX 리서치
          </Typography>
        </Link>
      </FlexBox>

      {/* Navigation */}
      <nav className="flex-1 px-5 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href === "/admin" && pathname.startsWith("/admin"));
          const isDashboardDetail =
            href === "/dashboards" && pathname.startsWith("/dashboard/");

          return (
            <Link key={href} href={href} className="no-underline block">
              <FlexBox
                alignItems="center"
                gap="10px"
                sx={(theme) => ({
                  padding: "10px 12px",
                  borderRadius: "8px",
                  transition: "background-color 0.15s",
                  backgroundColor:
                    isActive || isDashboardDetail
                      ? theme.semantic.fill.strong
                      : "transparent",
                  "&:hover": {
                    backgroundColor:
                      isActive || isDashboardDetail
                        ? theme.semantic.fill.strong
                        : theme.semantic.fill.alternative,
                  },
                })}
              >
                <Icon
                  sx={(theme) => ({
                    fontSize: "18px",
                    color:
                      isActive || isDashboardDetail
                        ? theme.semantic.label.normal
                        : theme.semantic.label.alternative,
                  })}
                />
                <Typography
                  variant="body2"
                  weight={isActive || isDashboardDetail ? "bold" : "medium"}
                  sx={(theme) => ({
                    color:
                      isActive || isDashboardDetail
                        ? theme.semantic.label.normal
                        : theme.semantic.label.alternative,
                  })}
                >
                  {label}
                </Typography>
              </FlexBox>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <Box
        sx={(theme) => ({
          padding: "16px",
          borderTop: `1px solid ${theme.semantic.line.solid.normal}`,
        })}
      >
        {status === "loading" ? null : session?.user ? (
          <FlexBox alignItems="center" gap="10px">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt="프로필"
                className="size-8 rounded-full shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                {session.user.name?.charAt(0) || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Typography
                variant="caption1"
                weight="bold"
                noWrap
                sx={(theme) => ({ color: theme.semantic.label.normal, display: "block" })}
              >
                {session.user.name}
              </Typography>
              <Typography
                variant="caption2"
                noWrap
                sx={(theme) => ({ color: theme.semantic.label.alternative, display: "block" })}
              >
                {session.user.email}
              </Typography>
            </div>
            <button
              onClick={() => signOut()}
              className="cursor-pointer shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
              title="로그아웃"
            >
              <IconLogout
                sx={(theme) => ({
                  fontSize: "18px",
                  color: theme.semantic.label.alternative,
                })}
              />
            </button>
          </FlexBox>
        ) : (
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboards" })}
            className="w-full text-left cursor-pointer"
          >
            <Typography
              variant="body2"
              weight="medium"
              sx={(theme) => ({ color: theme.semantic.label.alternative })}
            >
              로그인
            </Typography>
          </button>
        )}
      </Box>
    </Box>
  );
}
