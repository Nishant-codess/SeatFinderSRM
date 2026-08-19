import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/verify-admin";
import { computeAnalytics, getUsageTrends } from "@/services/analytics";

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin.authorized) {
    return NextResponse.json({ error: admin.error }, { status: admin.error === "No token provided" ? 401 : 403 });
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const granularity = searchParams.get("granularity") as "daily" | "weekly" | "monthly" | null;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters: startDate, endDate" }, { status: 400 });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const [analytics, trends] = await Promise.all([
      computeAnalytics(start, end),
      granularity ? getUsageTrends(start, end, granularity) : Promise.resolve(null),
    ]);
    return NextResponse.json({ analytics, trends });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
