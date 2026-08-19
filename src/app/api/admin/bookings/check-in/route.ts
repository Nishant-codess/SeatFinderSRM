import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/verify-admin";
import { manualCheckIn } from "@/services/booking-management";

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin.authorized) {
    return NextResponse.json({ error: admin.error }, { status: admin.error === "No token provided" ? 401 : 403 });
  }

  const { bookingId, userId, reason } = await request.json();
  if (!bookingId || !userId || !reason) {
    return NextResponse.json({ error: "Missing required fields: bookingId, userId, reason" }, { status: 400 });
  }

  try {
    await manualCheckIn(bookingId, userId, admin.userId!, reason);
    return NextResponse.json({ success: true, message: "Manual check-in completed successfully" });
  } catch (error) {
    console.error("Error during manual check-in:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
