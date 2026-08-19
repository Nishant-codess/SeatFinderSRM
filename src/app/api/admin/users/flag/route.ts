import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/verify-admin";
import { flagUser } from "@/services/user-management";

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin.authorized) {
    return NextResponse.json({ error: admin.error }, { status: admin.error === "No token provided" ? 401 : 403 });
  }

  const { userId, reason } = await request.json();
  if (!userId || !reason) {
    return NextResponse.json({ error: "Missing required fields: userId, reason" }, { status: 400 });
  }

  try {
    await flagUser(userId, reason, admin.userId!);
    return NextResponse.json({ success: true, message: "User flagged successfully" });
  } catch (error) {
    console.error("Error flagging user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
