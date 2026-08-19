import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/verify-admin";
import { extendBookingWithPolicy } from "@/services/booking-extension";
import { getActiveBookingForUser } from "@/services/booking-management";

export async function POST(request: NextRequest) {
  const auth = await verifyUser(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json();
  const { bookingId, additionalMinutes } = body;

  if (!bookingId || !additionalMinutes) {
    return NextResponse.json({ error: "Missing required fields: bookingId, additionalMinutes" }, { status: 400 });
  }
  if (typeof additionalMinutes !== "number" || additionalMinutes <= 0) {
    return NextResponse.json({ error: "additionalMinutes must be a positive number" }, { status: 400 });
  }

  // Verify the booking belongs to this user
  const active = await getActiveBookingForUser(auth.userId!);
  if (!active || active.id !== bookingId) {
    return NextResponse.json({ error: "Booking not found or not yours" }, { status: 403 });
  }

  try {
    const result = await extendBookingWithPolicy(bookingId, auth.userId!, additionalMinutes);
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message, alternatives: result.alternatives }, { status: 400 });
    }
    return NextResponse.json({ success: true, newEndTime: result.newEndTime, message: "Booking extended successfully" });
  } catch (error) {
    console.error("Error extending booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
