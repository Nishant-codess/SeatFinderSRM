import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { requireAdmin } from "@/lib/verify-admin";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { seatId, action, maintenanceInfo } = await req.json();

    if (!seatId || !action) {
      return NextResponse.json({ error: "Missing fields: seatId, action" }, { status: 400 });
    }

    const { Item: seat } = await docClient.send(
      new GetCommand({ TableName: TABLES.SEATS, Key: { seatId } })
    );

    if (!seat) return NextResponse.json({ error: `Seat ${seatId} not found` }, { status: 404 });

    let newStatus: string;
    let extraAttrs: Record<string, any> = {};

    switch (action) {
      case "maintenance":
        if (!maintenanceInfo) {
          return NextResponse.json({ error: "maintenanceInfo required" }, { status: 400 });
        }
        newStatus = "maintenance";
        extraAttrs = { maintenanceInfo };
        break;
      case "out-of-service":
        if (!maintenanceInfo) {
          return NextResponse.json({ error: "maintenanceInfo required" }, { status: 400 });
        }
        newStatus = "out-of-service";
        extraAttrs = { maintenanceInfo };
        break;
      case "restore":
        newStatus = "available";
        extraAttrs = { maintenanceInfo: null };
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const setExprs = ["#s = :status"];
    const names: Record<string, string> = { "#s": "status" };
    const values: Record<string, any> = { ":status": newStatus };

    Object.entries(extraAttrs).forEach(([k, v], i) => {
      setExprs.push(`${k} = :v${i}`);
      values[`:v${i}`] = v;
    });

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SEATS,
        Key: { seatId },
        UpdateExpression: `SET ${setExprs.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seat maintenance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
