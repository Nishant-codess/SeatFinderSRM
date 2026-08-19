import { GetCommand, UpdateCommand, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { Booking, Seat, ExtensionResult, LibrarySettings } from "@/types";
import { getLibrarySettings } from "./library-settings";

export async function checkExtensionAvailability(
  bookingId: string,
  userId: string,
  additionalMinutes: number
): Promise<{ available: boolean; reason?: string }> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
  );

  if (!Item) return { available: false, reason: "Booking not found" };
  const booking = Item as Booking;

  if (booking.status !== "active" && booking.status !== "pending")
    return { available: false, reason: "Booking is not active" };

  const currentEnd = new Date(booking.endTime);
  const newEnd = new Date(currentEnd.getTime() + additionalMinutes * 60_000);

  // Check for conflicts on the same seat
  const { Items: allBookings = [] } = await docClient.send(
    new ScanCommand({
      TableName: TABLES.BOOKINGS,
      FilterExpression: "seatId = :sid",
      ExpressionAttributeValues: { ":sid": booking.seatId },
    })
  );

  const conflict = (allBookings as Booking[]).some((b) => {
    if (b.bookingId === bookingId) return false;
    if (["cancelled", "completed", "no-show"].includes(b.status)) return false;
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    return currentEnd < bEnd && newEnd > bStart;
  });

  if (conflict) return { available: false, reason: "Seat is already booked during that extension period" };
  return { available: true };
}

export async function extendBooking(
  bookingId: string,
  userId: string,
  additionalMinutes: number
): Promise<ExtensionResult> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
  );
  if (!Item) return { success: false, message: "Booking not found" };

  const booking = Item as Booking;
  const check = await checkExtensionAvailability(bookingId, userId, additionalMinutes);

  if (!check.available) {
    const alternatives = await findAlternativeSeats(booking, additionalMinutes);
    return { success: false, message: check.reason, alternatives };
  }

  const currentEnd = new Date(booking.endTime);
  const newEnd = new Date(currentEnd.getTime() + additionalMinutes * 60_000);

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.BOOKINGS,
      Key: { userId, bookingId },
      UpdateExpression:
        "SET endTime = :end, #dur = #dur + :mins, extendedFrom = if_not_exists(extendedFrom, :oldEnd), updatedAt = :now",
      ExpressionAttributeNames: { "#dur": "duration" },
      ExpressionAttributeValues: {
        ":end": newEnd.toISOString(),
        ":mins": additionalMinutes,
        ":oldEnd": booking.endTime,
        ":now": new Date().toISOString(),
      },
    })
  );

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.SEATS,
      Key: { seatId: booking.seatId },
      UpdateExpression: "SET occupiedUntil = :until",
      ExpressionAttributeValues: { ":until": newEnd.getTime() },
    })
  );

  return { success: true, newEndTime: newEnd.toISOString() };
}

export async function checkPolicyLimits(
  bookingId: string,
  userId: string,
  additionalMinutes: number
): Promise<{ allowed: boolean; reason?: string }> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
  );
  if (!Item) return { allowed: false, reason: "Booking not found" };

  const booking = Item as Booking;
  const settings = await getLibrarySettings();
  if (!settings) return { allowed: true };

  if (booking.duration + additionalMinutes > settings.bookingRules.maxBookingDuration) {
    return {
      allowed: false,
      reason: `Extension would exceed maximum booking duration of ${settings.bookingRules.maxBookingDuration} minutes`,
    };
  }

  return { allowed: true };
}

export async function extendBookingWithPolicy(
  bookingId: string,
  userId: string,
  additionalMinutes: number
): Promise<ExtensionResult> {
  const policy = await checkPolicyLimits(bookingId, userId, additionalMinutes);
  if (!policy.allowed) return { success: false, message: policy.reason };
  return extendBooking(bookingId, userId, additionalMinutes);
}

async function findAlternativeSeats(booking: Booking, additionalMinutes: number): Promise<Seat[]> {
  const currentEnd = new Date(booking.endTime);
  const newEnd = new Date(currentEnd.getTime() + additionalMinutes * 60_000);

  const { Items: seats = [] } = await docClient.send(
    new ScanCommand({
      TableName: TABLES.SEATS,
      FilterExpression: "#s = :avail",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":avail": "available" },
    })
  );

  const currentSeat = (await docClient.send(
    new GetCommand({ TableName: TABLES.SEATS, Key: { seatId: booking.seatId } })
  )).Item;

  const { Items: allBookings = [] } = await docClient.send(
    new ScanCommand({ TableName: TABLES.BOOKINGS })
  );

  return (seats as Seat[]).filter((seat) => {
    if (seat.id === booking.seatId) return false;
    if (currentSeat && seat.section !== currentSeat.section) return false;
    return !(allBookings as Booking[]).some((b) => {
      if (b.seatId !== seat.id) return false;
      if (["cancelled", "completed", "no-show"].includes(b.status)) return false;
      return currentEnd < new Date(b.endTime) && newEnd > new Date(b.startTime);
    });
  });
}

export async function isUrgentExtension(bookingId: string, userId: string): Promise<boolean> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
  );
  if (!Item) return false;
  const mins = (new Date((Item as Booking).endTime).getTime() - Date.now()) / 60_000;
  return mins <= 15 && mins > 0;
}
