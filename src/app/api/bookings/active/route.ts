import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/verify-admin";
import { getActiveBookingForUser } from "@/services/booking-management";

export async function GET(request: NextRequest) {
  const auth = await verifyUser(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const booking = await getActiveBookingForUser(auth.userId!);
  return NextResponse.json({ booking });
}
