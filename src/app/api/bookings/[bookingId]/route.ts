import { NextRequest, NextResponse } from "next/server";
import { docClient, cognitoAdmin, TABLES } from "@/lib/aws";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { requireUser } from "@/lib/verify-admin";

// DELETE /api/bookings/[bookingId] — cancel own booking
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const authErr = await requireUser(req);
  if (authErr) return authErr;

  const { bookingId } = await params;
  const token = req.headers.get("Authorization")!.replace("Bearer ", "");
  const cognitoUser = await cognitoAdmin.send(new GetUserCommand({ AccessToken: token }));
  const userId = cognitoUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";

  const { Item: booking } = await docClient.send(
    new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
  );

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.userId !== userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!["pending", "active"].includes(booking.status)) {
    return NextResponse.json({ error: "Only pending or active bookings can be cancelled." }, { status: 400 });
  }

  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.BOOKINGS,
      Key: { userId, bookingId },
      UpdateExpression: "SET #s = :expired, updatedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":expired": "expired", ":now": now },
    })
  );

  // Release seat
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.SEATS,
      Key: { seatId: booking.seatId },
      UpdateExpression: "SET #s = :available, bookedBy = :n, bookedAt = :n, bookingId = :n, occupiedUntil = :n",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":available": "available", ":n": null },
    })
  );

  return NextResponse.json({ success: true });
}
