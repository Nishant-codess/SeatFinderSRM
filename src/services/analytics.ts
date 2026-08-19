import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { AnalyticsData, UsageTrend, Booking, Seat, PeakHour } from "@/types";

export async function computeAnalytics(startDate: Date, endDate: Date): Promise<AnalyticsData> {
  const [bookings, seats] = await Promise.all([getBookingsInRange(startDate, endDate), getAllSeats()]);

  return {
    occupancyRate: calculateOccupancyRate(bookings, seats, startDate, endDate),
    peakHours: calculatePeakHours(bookings),
    averageDuration: calculateAverageDuration(bookings),
    noShowRate: calculateNoShowRate(bookings),
    totalBookings: bookings.length,
    activeBookings: bookings.filter((b) => b.status === "active").length,
    completedBookings: bookings.filter((b) => b.status === "completed").length,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  };
}

export async function getUsageTrends(
  startDate: Date,
  endDate: Date,
  granularity: "daily" | "weekly" | "monthly"
): Promise<UsageTrend[]> {
  const [bookings, seats] = await Promise.all([getBookingsInRange(startDate, endDate), getAllSeats()]);
  const periods = generateTimePeriods(startDate, endDate, granularity);

  return periods.map((period) => {
    const periodBookings = bookings.filter((b) => {
      const d = new Date(b.startTime);
      return d >= period.start && d < period.end;
    });
    return {
      date: period.label,
      bookings: periodBookings.length,
      occupancyRate: calculateOccupancyRate(periodBookings, seats, period.start, period.end),
      averageDuration: calculateAverageDuration(periodBookings),
    };
  });
}

export async function getPeakHours(startDate: Date, endDate: Date): Promise<PeakHour[]> {
  return calculatePeakHours(await getBookingsInRange(startDate, endDate));
}

export async function getCurrentOccupancy(): Promise<{ occupied: number; total: number; rate: number }> {
  const seats = await getAllSeats();
  const total = seats.length;
  const occupied = seats.filter((s) => s.status === "occupied" || s.status === "reserved").length;
  return { occupied, total, rate: total > 0 ? (occupied / total) * 100 : 0 };
}

async function getBookingsInRange(startDate: Date, endDate: Date): Promise<Booking[]> {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.BOOKINGS }));
    return (Items as Booking[]).filter((b) => {
      const d = new Date(b.startTime);
      return d >= startDate && d <= endDate;
    });
  } catch {
    return [];
  }
}

async function getAllSeats(): Promise<Seat[]> {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.SEATS }));
    return Items as Seat[];
  } catch {
    return [];
  }
}

function calculateOccupancyRate(bookings: Booking[], seats: Seat[], start: Date, end: Date): number {
  if (!seats.length || !bookings.length) return 0;
  const totalHours = (end.getTime() - start.getTime()) / 3_600_000;
  if (totalHours <= 0) return 0;
  const totalAvailable = totalHours * seats.length;

  const occupied = bookings
    .filter((b) => b.status === "completed" || b.status === "active")
    .reduce((sum, b) => {
      const s = new Date(b.startTime) < start ? start : new Date(b.startTime);
      const e = b.exitTime ? new Date(b.exitTime) : new Date(b.endTime);
      const clamped = e > end ? end : e;
      const mins = (clamped.getTime() - s.getTime()) / 60_000;
      return sum + Math.max(0, mins);
    }, 0) / 60;

  return Math.min(100, Math.max(0, (occupied / totalAvailable) * 100));
}

function calculatePeakHours(bookings: Booking[]): PeakHour[] {
  const counts: Record<number, number> = {};
  bookings.forEach((b) => {
    const h = new Date(b.startTime).getHours();
    counts[h] = (counts[h] ?? 0) + 1;
  });
  return Object.entries(counts)
    .map(([h, count]) => ({ hour: +h, count, percentage: bookings.length ? (count / bookings.length) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function calculateAverageDuration(bookings: Booking[]): number {
  const done = bookings.filter((b) => b.status === "completed" && b.exitTime);
  if (!done.length) return 0;
  const total = done.reduce((s, b) => {
    const mins = (new Date(b.exitTime!).getTime() - new Date(b.startTime).getTime()) / 60_000;
    return s + Math.max(0, mins);
  }, 0);
  return Math.max(0, total / done.length);
}

function calculateNoShowRate(bookings: Booking[]): number {
  if (!bookings.length) return 0;
  return (bookings.filter((b) => b.status === "no-show").length / bookings.length) * 100;
}

function generateTimePeriods(start: Date, end: Date, granularity: "daily" | "weekly" | "monthly") {
  const periods: { start: Date; end: Date; label: string }[] = [];
  const cur = new Date(start);
  while (cur < end) {
    const pStart = new Date(cur);
    let pEnd: Date, label: string;
    if (granularity === "daily") {
      pEnd = new Date(cur); pEnd.setDate(pEnd.getDate() + 1);
      label = pStart.toISOString().split("T")[0];
    } else if (granularity === "weekly") {
      pEnd = new Date(cur); pEnd.setDate(pEnd.getDate() + 7);
      label = `Week of ${pStart.toISOString().split("T")[0]}`;
    } else {
      pEnd = new Date(cur); pEnd.setMonth(pEnd.getMonth() + 1);
      label = pStart.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }
    if (pEnd > end) pEnd = new Date(end);
    periods.push({ start: pStart, end: pEnd, label });
    cur.setTime(pEnd.getTime());
  }
  return periods;
}
