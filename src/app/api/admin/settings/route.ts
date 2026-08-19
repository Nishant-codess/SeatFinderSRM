import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/verify-admin";
import { getLibrarySettings, updateLibrarySettings } from "@/services/library-settings";
import type { LibrarySettings } from "@/types";

const DEFAULT_SETTINGS: LibrarySettings = {
  operatingHours: {
    monday:    { open: "09:00", close: "20:00", isClosed: false },
    tuesday:   { open: "09:00", close: "20:00", isClosed: false },
    wednesday: { open: "09:00", close: "20:00", isClosed: false },
    thursday:  { open: "09:00", close: "20:00", isClosed: false },
    friday:    { open: "09:00", close: "20:00", isClosed: false },
    saturday:  { open: "09:00", close: "17:00", isClosed: false },
    sunday:    { open: "00:00", close: "00:00", isClosed: true  },
  },
  holidays: [],
  bookingRules: {
    maxDailyDuration: 480,
    maxAdvanceBookingDays: 1,
    minBookingDuration: 30,
    maxBookingDuration: 480,
    extensionIncrement: 30,
  },
  updatedBy: "system",
  updatedAt: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const settings = await getLibrarySettings();
  return NextResponse.json({ settings: settings ?? DEFAULT_SETTINGS });
}

export async function PUT(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json();
  const { settings } = body as { settings: LibrarySettings };

  if (!settings?.operatingHours) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }

  // Pull admin identity from verifyAdmin internals (token is already verified)
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { GetUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
  const { cognitoAdmin } = await import("@/lib/aws");
  const cogUser = await cognitoAdmin.send(new GetUserCommand({ AccessToken: token }));
  const adminId = cogUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "unknown";

  await updateLibrarySettings(settings, adminId);
  return NextResponse.json({ ok: true });
}
