import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { requireUser } from "@/lib/verify-admin";

export async function POST(req: NextRequest) {
  const authErr = await requireUser(req);
  if (authErr) return authErr;

  try {
    const { bookingId, userId, seatId } = await req.json();
    if (!bookingId || !userId || !seatId) {
      return NextResponse.json({ error: "Invalid QR code data." }, { status: 400 });
    }

    const { Item: booking } = await docClient.send(
      new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
    );

    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (booking.status !== "active") {
      return NextResponse.json({ error: `Cannot check out. Booking is ${booking.status}.` }, { status: 400 });
    }

    const now = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { userId, bookingId },
        UpdateExpression: "SET #s = :completed, exitTime = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":completed": "completed", ":now": now },
      })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SEATS,
        Key: { seatId },
        UpdateExpression:
          "SET #s = :available, bookedBy = :n, bookedAt = :n, bookingId = :n, occupiedUntil = :n",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":available": "available", ":n": null },
      })
    );

    return NextResponse.json({ success: true, seatId });
  } catch (error) {
    console.error("Check-out error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
