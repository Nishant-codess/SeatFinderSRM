import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { requireUser } from "@/lib/verify-admin";
import { validateBookingTime } from "@/services/library-settings";
import { v4 as uuid } from "uuid";

// GET /api/bookings — list authenticated user's bookings
export async function GET(req: NextRequest) {
  const authErr = await requireUser(req);
  if (authErr) return authErr;

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

  const { GetUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
  const { cognitoAdmin } = await import("@/lib/aws");
  const cognitoUser = await cognitoAdmin.send(new GetUserCommand({ AccessToken: token }));
  const sub = cognitoUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";

  const { Items = [] } = await docClient.send(
    new QueryCommand({
      TableName: TABLES.BOOKINGS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": sub },
      ScanIndexForward: false,
    })
  );

  const bookings = (Items as any[]).sort(
    (a, b) => new Date(b.bookingTime).getTime() - new Date(a.bookingTime).getTime()
  );

  return NextResponse.json({ bookings });
}

// POST /api/bookings — create a booking
export async function POST(req: NextRequest) {
  const authErr = await requireUser(req);
  if (authErr) return authErr;

  const { seatId, endTime, userId, userEmail } = await req.json();
  if (!seatId || !endTime || !userId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Validate against library operating hours
  const hoursCheck = await validateBookingTime(new Date(), new Date(endTime));
  if (!hoursCheck.valid) {
    return NextResponse.json({ error: hoursCheck.reason }, { status: 422 });
  }

  // Fetch seat to check availability
  const { Item: seat } = await docClient.send(
    new GetCommand({ TableName: TABLES.SEATS, Key: { seatId } })
  );
  if (!seat) return NextResponse.json({ error: "Seat not found." }, { status: 404 });
  if (seat.status !== "available") {
    return NextResponse.json({ error: "Seat is not available." }, { status: 409 });
  }

  // Check user has no active booking
  const { Items: existing = [] } = await docClient.send(
    new QueryCommand({
      TableName: TABLES.BOOKINGS,
      KeyConditionExpression: "userId = :uid",
      FilterExpression: "#s IN (:pending, :active)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":uid": userId,
        ":pending": "pending",
        ":active": "active",
      },
    })
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: "You already have an active booking." }, { status: 409 });
  }

  const bookingId = uuid();
  const now = new Date().toISOString();
  const endTimeISO = new Date(endTime).toISOString();
  const durationMs = new Date(endTime).getTime() - Date.now();
  const durationMinutes = Math.round(durationMs / 60_000);

  const booking = {
    userId,
    bookingId,
    seatId,
    userEmail: userEmail ?? "",
    userName: (userEmail ?? "").split("@")[0] || "User",
    bookingTime: now,
    startTime: now,
    endTime: endTimeISO,
    status: "pending",
    duration: durationMinutes,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: TABLES.BOOKINGS, Item: booking }));

  // Update seat to reserved
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.SEATS,
      Key: { seatId },
      ConditionExpression: "#s = :available",
      UpdateExpression:
        "SET #s = :reserved, bookedBy = :uid, bookedAt = :now, bookingId = :bid",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":available": "available",
        ":reserved": "reserved",
        ":uid": userId,
        ":now": now,
        ":bid": bookingId,
      },
    })
  );

  return NextResponse.json({ booking: { ...booking, id: bookingId } });
}
