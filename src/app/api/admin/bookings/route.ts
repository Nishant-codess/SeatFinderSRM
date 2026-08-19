import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { requireAdmin } from "@/lib/verify-admin";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.BOOKINGS }));
    const bookings = (Items as any[]).sort(
      (a, b) => new Date(b.bookingTime ?? 0).getTime() - new Date(a.bookingTime ?? 0).getTime()
    );
    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("Admin bookings fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
