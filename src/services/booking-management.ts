import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { Booking, BookingFilters } from "@/types";

export async function getAllBookings(filters?: BookingFilters): Promise<Booking[]> {
  try {
    const { Items = [] } = await docClient.send(
      new ScanCommand({ TableName: TABLES.BOOKINGS })
    );

    let bookings = Items as Booking[];
    if (filters) bookings = applyFilters(bookings, filters);
    return bookings;
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }
}

function applyFilters(bookings: Booking[], filters: BookingFilters): Booking[] {
  let result = [...bookings];

  if (filters.userId)
    result = result.filter((b) => b.userId === filters.userId);
  if (filters.seatId)
    result = result.filter((b) => b.seatId === filters.seatId);
  if (filters.status)
    result = result.filter((b) => b.status === filters.status);
  if (filters.startDate)
    result = result.filter((b) => new Date(b.startTime) >= filters.startDate!);
  if (filters.endDate)
    result = result.filter((b) => new Date(b.startTime) <= filters.endDate!);
  if (filters.searchTerm?.trim()) {
    const term = filters.searchTerm.toLowerCase();
    result = result.filter(
      (b) =>
        b.userName.toLowerCase().includes(term) ||
        b.userEmail.toLowerCase().includes(term) ||
        b.seatId.toLowerCase().includes(term)
    );
  }

  return result;
}

export async function getPaginatedBookings(
  page: number,
  pageSize: number,
  filters?: BookingFilters
): Promise<{ bookings: Booking[]; total: number; totalPages: number }> {
  const all = await getAllBookings(filters);
  const total = all.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return { bookings: all.slice(start, start + pageSize), total, totalPages };
}

export async function getActiveBookingForUser(userId: string): Promise<Booking | null> {
  try {
    const { Items = [] } = await docClient.send(
      new QueryCommand({
        TableName: TABLES.BOOKINGS,
        KeyConditionExpression: "userId = :uid",
        FilterExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":uid": userId, ":active": "active" },
      })
    );
    return (Items[0] as Booking) ?? null;
  } catch (error) {
    console.error("Error fetching active booking:", error);
    return null;
  }
}

export async function cancelBooking(
  bookingId: string,
  userId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { userId, bookingId },
        UpdateExpression:
          "SET #s = :cancelled, cancelledBy = :admin, cancelReason = :reason, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":cancelled": "cancelled",
          ":admin": adminId,
          ":reason": reason,
          ":now": new Date().toISOString(),
        },
      })
    );

    // Fetch booking to get seatId
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
    );

    if (Item?.seatId) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.SEATS,
          Key: { seatId: Item.seatId },
          UpdateExpression:
            "SET #s = :avail, bookedBy = :null, bookingId = :null, bookedAt = :null, occupiedUntil = :null",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":avail": "available",
            ":null": null,
          },
        })
      );
    }

    await logAdminAction(adminId, "cancel_booking", bookingId, "booking", reason, {
      userId,
      seatId: Item?.seatId,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    throw error;
  }
}

export async function manuallyAssignSeat(
  seatId: string,
  userId: string,
  userName: string,
  userEmail: string,
  startTime: Date,
  endTime: Date,
  adminId: string
): Promise<Booking> {
  try {
    const { Item: seat } = await docClient.send(
      new GetCommand({ TableName: TABLES.SEATS, Key: { seatId } })
    );

    if (!seat) throw new Error("Seat not found");
    if (seat.status !== "available") throw new Error("Seat is not available");

    const bookingId = `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    const booking: Booking = {
      id: bookingId,
      seatId,
      userId,
      userName,
      userEmail,
      bookingTime: new Date().toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: "pending",
      duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({ TableName: TABLES.BOOKINGS, Item: { ...booking, bookingId } })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SEATS,
        Key: { seatId },
        UpdateExpression:
          "SET #s = :reserved, bookedBy = :uid, bookingId = :bid, bookedAt = :now, occupiedUntil = :until",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":reserved": "reserved",
          ":uid": userId,
          ":bid": bookingId,
          ":now": Date.now(),
          ":until": endTime.getTime(),
        },
      })
    );

    await logAdminAction(adminId, "manual_assign", bookingId, "booking", "Manual seat assignment", {
      userId,
      seatId,
    });

    return booking;
  } catch (error) {
    console.error("Error assigning seat:", error);
    throw error;
  }
}

export async function manualCheckIn(
  bookingId: string,
  userId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const now = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { userId, bookingId },
        UpdateExpression: "SET #s = :active, entryTime = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":active": "active", ":now": now },
      })
    );

    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
    );

    if (Item?.seatId) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.SEATS,
          Key: { seatId: Item.seatId },
          UpdateExpression: "SET #s = :occupied",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":occupied": "occupied" },
        })
      );
    }

    await logAdminAction(adminId, "manual_checkin", bookingId, "booking", reason, { userId });
  } catch (error) {
    console.error("Error during manual check-in:", error);
    throw error;
  }
}

export async function manualCheckOut(
  bookingId: string,
  userId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.BOOKINGS, Key: { userId, bookingId } })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { userId, bookingId },
        UpdateExpression: "SET #s = :completed, exitTime = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":completed": "completed", ":now": now },
      })
    );

    if (Item?.seatId) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.SEATS,
          Key: { seatId: Item.seatId },
          UpdateExpression:
            "SET #s = :avail, bookedBy = :null, bookingId = :null, bookedAt = :null, occupiedUntil = :null",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":avail": "available", ":null": null },
        })
      );
    }

    await logAdminAction(adminId, "manual_checkout", bookingId, "booking", reason, { userId });
  } catch (error) {
    console.error("Error during manual check-out:", error);
    throw error;
  }
}

async function logAdminAction(
  adminId: string,
  action: string,
  targetId: string,
  targetType: "booking" | "user" | "seat" | "settings",
  reason?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUDIT_LOGS,
        Item: {
          logId,
          timestamp: new Date().toISOString(),
          adminId,
          action,
          targetId,
          targetType,
          reason,
          details,
        },
      })
    );
  } catch (error) {
    console.error("Error logging admin action:", error);
  }
}
