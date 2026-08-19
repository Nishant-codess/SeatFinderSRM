import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { requireAdmin } from "@/lib/verify-admin";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.FEEDBACK }));
    const tickets = (Items as any[]).sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Admin feedback fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { ticketId, status, response, adminEmail } = await req.json();
    if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 });

    const setExprs: string[] = ["updatedAt = :ua"];
    const values: Record<string, any> = { ":ua": new Date().toISOString() };

    if (status) {
      setExprs.push("#st = :status");
      values[":status"] = status;
    }

    if (response && adminEmail) {
      // Fetch current responses and append
      const { Items = [] } = await docClient.send(
        new ScanCommand({
          TableName: TABLES.FEEDBACK,
          FilterExpression: "feedbackId = :tid",
          ExpressionAttributeValues: { ":tid": ticketId },
        })
      );
      const ticket = Items[0] as any;
      const existing = ticket?.responses ?? [];
      existing.push({
        message: response,
        respondedBy: adminEmail,
        respondedAt: new Date().toISOString(),
        isAdmin: true,
      });
      setExprs.push("responses = :resp");
      values[":resp"] = existing;
      if (!status) {
        setExprs.push("#st = :status");
        values[":status"] = "in-progress";
      }
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.FEEDBACK,
        Key: { feedbackId: ticketId },
        UpdateExpression: `SET ${setExprs.join(", ")}`,
        ExpressionAttributeNames: setExprs.some((e) => e.includes("#st"))
          ? { "#st": "status" }
          : undefined,
        ExpressionAttributeValues: values,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin feedback update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
