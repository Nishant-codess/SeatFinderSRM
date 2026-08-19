import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { ReportConfig, ReportData, ReportFormat, Booking, Seat } from "@/types";

export async function generateReport(config: ReportConfig): Promise<ReportData> {
  const [bookings, seats] = await Promise.all([
    getBookingsInRange(config.dateRange.start, config.dateRange.end),
    getAllSeats(),
  ]);

  let filtered = bookings;
  if (config.filters?.section) {
    const ids = new Set(seats.filter((s) => s.section === config.filters?.section).map((s) => s.id));
    filtered = filtered.filter((b) => ids.has(b.seatId));
  }

  const summary: Record<string, number | string> = {};
  config.metrics.forEach((metric) => {
    switch (metric) {
      case "occupancy":
        summary["Occupancy Rate (%)"] = calcOccupancy(filtered, seats, config.dateRange.start, config.dateRange.end);
        break;
      case "no-show-rate":
        summary["No-Show Rate (%)"] = calcNoShow(filtered);
        break;
      case "average-duration":
        summary["Average Duration (hours)"] = calcAvgDuration(filtered);
        break;
      case "user-activity":
        summary["Total Bookings"] = filtered.length;
        summary["Active Users"] = new Set(filtered.map((b) => b.userId)).size;
        break;
    }
  });

  const data = config.groupBy
    ? groupBookings(filtered, config.groupBy)
    : filtered.map((b) => ({
        "Booking ID": b.id,
        User: b.userName,
        Seat: b.seatId,
        "Start Time": b.startTime,
        "End Time": b.endTime,
        Status: b.status,
        "Duration (min)": b.duration,
      }));

  return {
    title: `Report: ${config.metrics.join(", ")}`,
    generatedAt: new Date().toISOString(),
    dateRange: { start: config.dateRange.start.toISOString(), end: config.dateRange.end.toISOString() },
    summary,
    data,
  };
}

export async function exportReport(reportData: ReportData, format: ReportFormat): Promise<Blob> {
  switch (format) {
    case "csv": return exportCSV(reportData);
    case "pdf": return new Blob([JSON.stringify(reportData, null, 2)], { type: "application/pdf" });
    case "excel": return new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    default: throw new Error(`Unsupported format: ${format}`);
  }
}

async function getBookingsInRange(start: Date, end: Date): Promise<Booking[]> {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.BOOKINGS }));
    return (Items as Booking[]).filter((b) => {
      const d = new Date(b.startTime);
      return d >= start && d <= end;
    });
  } catch { return []; }
}

async function getAllSeats(): Promise<Seat[]> {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.SEATS }));
    return Items as Seat[];
  } catch { return []; }
}

function calcOccupancy(bookings: Booking[], seats: Seat[], start: Date, end: Date): number {
  if (!seats.length || !bookings.length) return 0;
  const totalHrs = (end.getTime() - start.getTime()) / 3_600_000;
  if (totalHrs <= 0) return 0;
  const occupied = bookings
    .filter((b) => b.status === "completed" || b.status === "active")
    .reduce((s, b) => {
      const bs = new Date(b.startTime) < start ? start : new Date(b.startTime);
      const be = b.exitTime ? new Date(b.exitTime) : new Date(b.endTime);
      const bc = be > end ? end : be;
      return s + Math.max(0, (bc.getTime() - bs.getTime()) / 60_000);
    }, 0) / 60;
  return Math.min(100, Math.max(0, Math.round((occupied / (totalHrs * seats.length)) * 10000) / 100));
}

function calcNoShow(bookings: Booking[]): number {
  if (!bookings.length) return 0;
  return Math.round((bookings.filter((b) => b.status === "no-show").length / bookings.length) * 10000) / 100;
}

function calcAvgDuration(bookings: Booking[]): number {
  const done = bookings.filter((b) => b.status === "completed" && b.exitTime);
  if (!done.length) return 0;
  const total = done.reduce((s, b) => s + Math.max(0, (new Date(b.exitTime!).getTime() - new Date(b.startTime).getTime()) / 3_600_000), 0);
  return Math.round((total / done.length) * 100) / 100;
}

function groupBookings(bookings: Booking[], by: "day" | "week" | "month"): Array<Record<string, unknown>> {
  const grouped: Record<string, Booking[]> = {};
  bookings.forEach((b) => {
    const d = new Date(b.startTime);
    let key = by === "day" ? d.toISOString().split("T")[0]
      : by === "week" ? (() => { const w = new Date(d); const dd = w.getDate() - w.getDay() + (w.getDay() === 0 ? -6 : 1); return new Date(w.setDate(dd)).toISOString().split("T")[0]; })()
      : d.toISOString().substring(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(b);
  });
  return Object.entries(grouped)
    .map(([period, bs]) => ({
      Period: period,
      "Total Bookings": bs.length,
      Completed: bs.filter((b) => b.status === "completed").length,
      "No-Shows": bs.filter((b) => b.status === "no-show").length,
      Cancelled: bs.filter((b) => b.status === "cancelled").length,
    }))
    .sort((a, b) => String(a.Period).localeCompare(String(b.Period)));
}

function exportCSV(report: ReportData): Blob {
  let csv = `${report.title}\nGenerated: ${report.generatedAt}\nDate Range: ${report.dateRange.start} to ${report.dateRange.end}\n\nSummary\n`;
  Object.entries(report.summary).forEach(([k, v]) => { csv += `${k},${v}\n`; });
  csv += "\n";
  if (report.data.length) {
    const headers = Object.keys(report.data[0]);
    csv += headers.join(",") + "\n";
    report.data.forEach((row) => {
      csv += headers.map((h) => {
        const v = String(row[h] ?? "");
        return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(",") + "\n";
    });
  }
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}
