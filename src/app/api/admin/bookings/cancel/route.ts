import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/verify-admin";
import { cancelBooking } from "@/services/booking-management";

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
    await cancelBooking(bookingId, userId, admin.userId!, reason);
    return NextResponse.json({ success: true, message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
