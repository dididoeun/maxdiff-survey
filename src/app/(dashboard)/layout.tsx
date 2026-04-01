"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Avatar, AvatarButton, Box, Button, FlexBox, Menu, MenuContent, MenuItem, MenuList, MenuTrigger } from "@wanteddev/wds";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // admin 페이지는 자체 GNB를 사용, embed 모드에서도 GNB 숨김
  const isEditorPage = /^\/admin(\/[^/]+)?$/.test(pathname);
  const isEmbed = searchParams.get("embed") === "1";

  if (isEditorPage || isEmbed) {
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* GNB */}
      <Box
        as="header"
        sx={() => ({
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(32px)",
          backgroundColor: "rgba(255, 255, 255, 0.88)",
        })}
      >
        <FlexBox
          alignItems="center"
          justifyContent="space-between"
          sx={{ padding: "14px 20px", maxWidth: "1400px", margin: "0 auto" }}
        >
          {/* Leading: Logo */}
          <Link href="/dashboards" className="flex items-center no-underline">
            <img src="/wanted-logo.svg" alt="wanted" style={{ height: "32px" }} />
          </Link>

          {/* Trailing: Actions */}
          <FlexBox alignItems="center" gap="16px">
            <Button
              as={Link}
              href="/admin"
              variant="solid"
              color="primary"
              size="small"
            >
              새 설문 만들기
            </Button>

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
                    <MenuItem
                      value="logout"
                      onClick={() => signOut()}
                    >
                      로그아웃
                    </MenuItem>
                  </MenuList>
                </MenuContent>
              </Menu>
            ) : (
              <Button
                variant="outlined"
                color="assistive"
                size="small"
                onClick={() => signIn("google", { callbackUrl: "/dashboards" })}
              >
                로그인
              </Button>
            )}
          </FlexBox>
        </FlexBox>
      </Box>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
