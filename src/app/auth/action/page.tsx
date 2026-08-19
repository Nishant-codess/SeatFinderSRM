"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Firebase auth action handler — no longer used with OTP-only auth.
// Redirects to home.
export default function AuthActionPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return (
    <main className="flex h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </main>
  );
}
