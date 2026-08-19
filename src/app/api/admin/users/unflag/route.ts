import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/verify-admin";
import { unflagUser } from "@/services/user-management";

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin.authorized) {
    return NextResponse.json({ error: admin.error }, { status: admin.error === "No token provided" ? 401 : 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing required field: userId" }, { status: 400 });
  }

  try {
    await unflagUser(userId, admin.userId!);
    return NextResponse.json({ success: true, message: "User unflagged successfully" });
  } catch (error) {
    console.error("Error unflagging user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
