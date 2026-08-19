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
    if (booking.status !== "pending") {
      return NextResponse.json({ error: `Cannot check in. Booking is ${booking.status}.` }, { status: 400 });
    }

    const now = new Date();
    const occupiedUntil = new Date(booking.endTime).getTime();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { userId, bookingId },
        UpdateExpression: "SET #s = :active, entryTime = :now, updatedAt = :nowISO",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":active": "active",
          ":now": now.toISOString(),
          ":nowISO": now.toISOString(),
        },
      })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SEATS,
        Key: { seatId },
        UpdateExpression: "SET #s = :occupied, occupiedUntil = :until",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":occupied": "occupied", ":until": occupiedUntil },
      })
    );

    return NextResponse.json({
      success: true,
      seatId,
      occupiedUntil: new Date(occupiedUntil).toISOString(),
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
