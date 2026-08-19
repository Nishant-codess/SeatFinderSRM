import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { requireAdmin } from "@/lib/verify-admin";

// GET /api/admin/manage-admins — list all admins
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const result = await docClient.send(new ScanCommand({ TableName: TABLES.ADMINS }));
  return NextResponse.json({ admins: result.Items ?? [] });
}

// POST /api/admin/manage-admins — add an admin
export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { email, name, addedBy } = await req.json();
  if (!email?.endsWith("@srmist.edu.in")) {
    return NextResponse.json({ error: "Only @srmist.edu.in emails allowed." }, { status: 400 });
  }

  await docClient.send(new PutCommand({
    TableName: TABLES.ADMINS,
    Item: {
      email,
      name: name ?? email.split("@")[0],
      addedBy: addedBy ?? "admin",
      addedAt: new Date().toISOString(),
      isActive: true,
    },
  }));

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/manage-admins — remove an admin
export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

  await docClient.send(new DeleteCommand({ TableName: TABLES.ADMINS, Key: { email } }));
  return NextResponse.json({ success: true });
}
