"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AutoSignIn() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboards";

  useEffect(() => {
    signIn("google", { callbackUrl });
  }, [callbackUrl]);

  return null;
}

export default function GoogleRedirectPage() {
  return (
    <Suspense>
      <AutoSignIn />
    </Suspense>
  );
}
