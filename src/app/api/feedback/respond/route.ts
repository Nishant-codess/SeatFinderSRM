import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyAdmin } from "@/lib/verify-admin";
import { getUserProfile } from "@/services/user-management";
import { addResponse } from "@/services/feedback";

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { userId: adminId } = await verifyAdmin(request);
    const body = await request.json();
    const { ticketId, message } = body;

    if (!ticketId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: ticketId, message" },
        { status: 400 }
      );
    }

    const adminProfile = await getUserProfile(adminId!);
    const authorName = adminProfile?.displayName || adminProfile?.email || "Admin";

    await addResponse(ticketId, adminId!, authorName, message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding response:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
