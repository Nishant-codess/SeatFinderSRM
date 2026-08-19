import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seatId: string }> }
) {
  try {
    const { seatId } = await params;
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.SEATS, Key: { seatId } })
    );
    if (!Item) return NextResponse.json({ error: "Seat not found" }, { status: 404 });
    return NextResponse.json({ seat: Item });
  } catch (error) {
    console.error("Error fetching seat:", error);
    return NextResponse.json({ error: "Failed to fetch seat" }, { status: 500 });
  }
}
