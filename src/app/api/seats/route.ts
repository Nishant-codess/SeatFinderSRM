import { NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { ScanCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const FLOORS = ["Ground", "First", "Second", "Third"] as const;
const FLOOR_PREFIX: Record<string, string> = { Ground: "G", First: "F", Second: "S", Third: "T" };
const FLOOR_KEY: Record<string, string> = { Ground: "ground", First: "first", Second: "second", Third: "third" };
const SEATS_PER_FLOOR = 50;

async function seedSeats() {
  const items = FLOORS.flatMap((floor) =>
    Array.from({ length: SEATS_PER_FLOOR }, (_, i) => {
      const num = (i + 1).toString().padStart(2, "0");
      const seatId = `${FLOOR_PREFIX[floor]}${num}`;
      return {
        PutRequest: {
          Item: {
            seatId,
            floor: FLOOR_KEY[floor],
            status: "available",
            bookedBy: null,
            bookedAt: null,
            bookingId: null,
            occupiedUntil: null,
          },
        },
      };
    })
  );

  // BatchWrite in chunks of 25 (DynamoDB limit)
  for (let i = 0; i < items.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({ RequestItems: { [TABLES.SEATS]: items.slice(i, i + 25) } })
    );
  }
}

export async function GET() {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.SEATS }));

    if (Items.length === 0) {
      await seedSeats();
      return NextResponse.redirect(new URL("/api/seats", "http://localhost"));
    }

    // Organize by floor, auto-expire stale reservations
    const now = Date.now();
    const RESERVATION_TTL_MS = 300_000; // 5 min
    const seats: Record<string, Record<string, any>> = {};

    for (const item of Items) {
      const floor = item.floor as string;
      if (!seats[floor]) seats[floor] = {};

      // Auto-expire stale reserved seats client-side (actual DB update via cleanup route)
      const seatData = { ...item };
      if (
        seatData.status === "reserved" &&
        seatData.bookedAt &&
        now - new Date(seatData.bookedAt).getTime() > RESERVATION_TTL_MS
      ) {
        seatData.status = "available";
      }

      seats[floor][item.seatId as string] = seatData;
    }

    return NextResponse.json({ seats });
  } catch (error) {
    console.error("Error fetching seats:", error);
    return NextResponse.json({ error: "Failed to fetch seats" }, { status: 500 });
  }
}
