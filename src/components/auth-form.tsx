"use client";

import { useState } from "react";
import Image from "next/image";
import { storeSession } from "@/lib/cognito-auth";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, ArrowLeft, BookOpen } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email().refine((e) => e.endsWith("@srmist.edu.in"), {
    message: "Only @srmist.edu.in emails are allowed.",
  }),
});

type EmailValues = z.infer<typeof emailSchema>;

export function AuthForm() {
  const { toast } = useToast();
  const router = useRouter();
  const { reload } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const handleSendOtp = async (values: EmailValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send OTP.");
      setPendingEmail(values.email);
      setOtp("");
      setOtpError("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to send OTP", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (code: string) => {
    if (!pendingEmail) return;
    if (code.length !== 6) { setOtpError("Enter the 6-digit code from your email."); return; }
    setLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      storeSession({ accessToken: data.accessToken, userId: data.userId, email: data.email, isAdmin: data.isAdmin });
      await reload();
      router.replace(data.isAdmin ? "/admin/analytics" : "/seats");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Incorrect OTP", description: err.message ?? "Verification failed." });
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resend OTP.");
      setOtp("");
      setOtpError("");
      toast({ title: "New OTP sent", description: "Check your SRM email." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to resend", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ── OTP screen ─────────────────────────────────────── */
  if (pendingEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-2xl bg-primary/10 p-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to
            </p>
            <p className="text-sm font-medium">{pendingEmail}</p>
          </div>

          {/* OTP input */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); submitOtp(otp); }} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="otp-input" className="text-sm font-medium">One-Time Password</label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  maxLength={6}
                  disabled={loading}
                  value={otp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(digits);
                    if (otpError) setOtpError("");
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                    setOtp(digits);
                    if (otpError) setOtpError("");
                    if (digits.length === 6) submitOtp(digits);
                  }}
                  className="flex h-14 w-full rounded-lg border border-input bg-background px-4 text-center text-2xl tracking-[.5em] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                {otpError && <p className="text-xs text-destructive">{otpError}</p>}
              </div>

              <Button type="submit" disabled={loading || otp.length === 0} className="w-full" size="lg">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying…</>
                  : "Sign In"}
              </Button>
            </form>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setPendingEmail(null); setOtp(""); setOtpError(""); emailForm.reset(); }}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change email
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Email screen ────────────────────────────────────── */
  return (
    <main className="min-h-screen flex bg-background">
      {/* Left panel — branding (md+) */}
      <div className="hidden md:flex md:w-1/2 bg-muted/30 border-r flex-col items-center justify-center p-12 gap-8">
        <div className="space-y-4 text-center max-w-xs">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Image src="/images/logo.png" width={52} height={52} alt="SeatFinderSRM" className="rounded-2xl shadow-lg" priority />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">SeatFinderSRM</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Reserve your library seat in seconds. No queues, no hassle — just scan and study.
          </p>
        </div>

        <div className="space-y-3 w-full max-w-xs text-sm text-muted-foreground">
          {[
            'Book any available seat instantly',
            'QR code check-in at the entrance',
            'Extend your session from the app',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <Image
            src="/images/image.png"
            width={200}
            height={50}
            alt="SRM Institute"
            className="rounded-lg opacity-80"
            priority
          />
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="md:hidden flex flex-col items-center gap-2 mb-2">
            <Image src="/images/logo.png" width={44} height={44} alt="SeatFinderSRM" className="rounded-xl" priority />
            <p className="font-bold text-lg">SeatFinderSRM</p>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Use your SRM email to receive a login code</p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleSendOtp)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="you@srmist.edu.in"
                            type="email"
                            className="pl-9"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending…</>
                    : "Send Login Code"}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Only <span className="font-medium text-foreground">@srmist.edu.in</span> emails are accepted
          </p>
        </div>
      </div>
    </main>
  );
}
