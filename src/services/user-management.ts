import { GetCommand, UpdateCommand, ScanCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { UserProfile, Booking, UserStatistics } from "@/types";

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { userId } })
    );
    return (Item as UserProfile) ?? null;
  } catch {
    return null;
  }
}

export async function getUserBookingHistory(userId: string, limit?: number): Promise<Booking[]> {
  try {
    const { Items = [] } = await docClient.send(
      new QueryCommand({
        TableName: TABLES.BOOKINGS,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
      })
    );

    const bookings = (Items as Booking[]).sort(
      (a, b) => new Date(b.bookingTime).getTime() - new Date(a.bookingTime).getTime()
    );

    return limit ? bookings.slice(0, limit) : bookings;
  } catch {
    return [];
  }
}

export async function flagUser(userId: string, reason: string, adminId: string): Promise<void> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.USERS, Key: { userId } })
  );
  if (!Item) throw new Error("User not found");

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: "SET restrictions = :r, updatedAt = :now",
      ExpressionAttributeValues: {
        ":r": { isFlagged: true, reason, flaggedBy: adminId, flaggedAt: new Date().toISOString() },
        ":now": new Date().toISOString(),
      },
    })
  );

  await logAdminAction(adminId, "flag_user", userId, "user", reason);
}

export async function unflagUser(userId: string, adminId: string): Promise<void> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.USERS, Key: { userId } })
  );
  if (!Item) throw new Error("User not found");

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: "SET restrictions = :r, updatedAt = :now",
      ExpressionAttributeValues: {
        ":r": { isFlagged: false },
        ":now": new Date().toISOString(),
      },
    })
  );

  await logAdminAction(adminId, "unflag_user", userId, "user", "Restrictions removed");
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.USERS }));
    const lower = query.toLowerCase().trim();
    return (Items as UserProfile[]).filter(
      (u) =>
        (u as any).role !== "admin" &&
        (u.email.toLowerCase().includes(lower) ||
          u.displayName?.toLowerCase().includes(lower))
    );
  } catch {
    return [];
  }
}

export async function getUserStatistics(userId: string): Promise<UserStatistics> {
  try {
    const bookings = await getUserBookingHistory(userId);
    const completed = bookings.filter((b) => b.status === "completed" && b.entryTime);

    const totalHoursBooked = completed.reduce((sum, b) => {
      const start = new Date(b.entryTime!);
      const end = new Date(b.exitTime ?? b.endTime);
      return sum + Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
    }, 0);

    const averageSessionDuration = completed.length ? totalHoursBooked / completed.length : 0;
    const noShowCount = bookings.filter((b) => b.status === "no-show").length;
    const overstayCount = bookings.filter((b) => {
      if (b.status !== "completed" || !b.exitTime) return false;
      return new Date(b.exitTime) > new Date(b.endTime);
    }).length;

    const seatCounts: Record<string, number> = {};
    completed.forEach((b) => { seatCounts[b.seatId] = (seatCounts[b.seatId] ?? 0) + 1; });
    const mostBookedSeats = Object.entries(seatCounts)
      .map(([seatId, count]) => ({ seatId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hourCounts: Record<number, number> = {};
    completed.forEach((b) => {
      const h = new Date(b.startTime).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const preferredTimeSlots = Object.entries(hourCounts)
      .map(([h, count]) => ({ hour: +h, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalBookings: bookings.length,
      totalHoursBooked,
      averageSessionDuration,
      noShowCount,
      overstayCount,
      mostBookedSeats,
      preferredTimeSlots,
      weeklyUsage: calcWeekly(completed),
      monthlyUsage: calcMonthly(completed),
    };
  } catch {
    return {
      totalBookings: 0,
      totalHoursBooked: 0,
      averageSessionDuration: 0,
      noShowCount: 0,
      overstayCount: 0,
      mostBookedSeats: [],
      preferredTimeSlots: [],
      weeklyUsage: [],
      monthlyUsage: [],
    };
  }
}

function calcWeekly(bookings: Booking[]): Array<{ week: string; hours: number }> {
  const data: Record<string, number> = {};
  bookings.forEach((b) => {
    if (!b.entryTime) return;
    const hrs = (new Date(b.exitTime ?? b.endTime).getTime() - new Date(b.entryTime).getTime()) / 3_600_000;
    const d = new Date(b.entryTime);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const key = new Date(d.setDate(diff)).toISOString().split("T")[0];
    data[key] = (data[key] ?? 0) + Math.max(0, hrs);
  });
  return Object.entries(data).map(([week, hours]) => ({ week, hours }))
    .sort((a, b) => a.week.localeCompare(b.week)).slice(-12);
}

function calcMonthly(bookings: Booking[]): Array<{ month: string; hours: number }> {
  const data: Record<string, number> = {};
  bookings.forEach((b) => {
    if (!b.entryTime) return;
    const hrs = (new Date(b.exitTime ?? b.endTime).getTime() - new Date(b.entryTime).getTime()) / 3_600_000;
    const key = new Date(b.entryTime).toISOString().substring(0, 7);
    data[key] = (data[key] ?? 0) + Math.max(0, hrs);
  });
  return Object.entries(data).map(([month, hours]) => ({ month, hours }))
    .sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
}

async function logAdminAction(
  adminId: string,
  action: string,
  targetId: string,
  targetType: "booking" | "user" | "seat" | "settings",
  reason?: string
): Promise<void> {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUDIT_LOGS,
        Item: { logId, timestamp: new Date().toISOString(), adminId, action, targetId, targetType, reason },
      })
    );
  } catch {
    // Non-fatal
  }
}
