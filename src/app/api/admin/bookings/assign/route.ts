import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyAdmin } from "@/lib/verify-admin";
import { manuallyAssignSeat } from "@/services/booking-management";

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { userId: adminId } = await verifyAdmin(request).then((r) => r);
    const body = await request.json();
    const { seatId, userId, userName, userEmail, startTime, endTime } = body;

    if (!seatId || !userId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields: seatId, userId, startTime, endTime" },
        { status: 400 }
      );
    }

    const booking = await manuallyAssignSeat(
      seatId,
      userId,
      userName || "User",
      userEmail || "",
      new Date(startTime),
      new Date(endTime),
      adminId!
    );

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("Error assigning seat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
