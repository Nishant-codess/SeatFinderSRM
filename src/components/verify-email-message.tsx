"use client";

// OTP-only auth: email verification is not needed.
// This component is kept as a no-op stub for compatibility.

interface VerifyEmailMessageProps {
  email: string | null;
  onLogout: () => void;
}

export function VerifyEmailMessage(_props: VerifyEmailMessageProps) {
  return null;
}
