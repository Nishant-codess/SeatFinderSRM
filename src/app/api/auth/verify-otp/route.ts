import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLES } from "@/lib/aws";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();
  if (!email || !otp) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Retrieve stored OTP
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.USERS, Key: { userId: `otp#${email}` } })
  );

  if (!Item) {
    return NextResponse.json(
      { error: "No OTP found. Request a new one." },
      { status: 401 }
    );
  }

  if (new Date(Item.expiresAt) < new Date()) {
    return NextResponse.json({ error: "OTP expired. Request a new one." }, { status: 401 });
  }

  if (Item.otp !== String(otp).trim()) {
    return NextResponse.json({ error: "Incorrect OTP." }, { status: 401 });
  }

  const userId = Item.realUserId as string;

  // Delete OTP record so it can't be replayed
  await docClient.send(
    new DeleteCommand({ TableName: TABLES.USERS, Key: { userId: `otp#${email}` } })
  );

  // Check if this email is an active admin
  const adminItem = await docClient.send(
    new GetCommand({ TableName: TABLES.ADMINS, Key: { email } })
  );
  const isAdmin = !!(adminItem.Item?.isActive);

  // Issue custom HS256 JWT — no Cognito token dependency
  const accessToken = await new SignJWT({ email, isAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);

  return NextResponse.json({ accessToken, userId, email, isAdmin });
}
