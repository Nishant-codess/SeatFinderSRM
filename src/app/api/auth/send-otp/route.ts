import { NextRequest, NextResponse } from "next/server";
import { cognitoAdmin, docClient, TABLES } from "@/lib/aws";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import nodemailer from "nodemailer";

const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
});

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (typeof email !== "string" || !email.endsWith("@srmist.edu.in")) {
    return NextResponse.json({ error: "Only @srmist.edu.in emails are allowed." }, { status: 400 });
  }

  // Auto-create Cognito user on first auth (suppresses welcome email)
  try {
    const tempPwd = `${crypto.randomUUID()}Aa1!`;
    await cognitoAdmin.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: email,
        MessageAction: "SUPPRESS",
        TemporaryPassword: tempPwd,
      })
    );
    await cognitoAdmin.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: POOL_ID,
        Username: email,
        Password: `${crypto.randomUUID()}Aa1!`,
        Permanent: true,
      })
    );
  } catch (err: any) {
    if (err.name !== "UsernameExistsException") {
      console.error("AdminCreateUser error:", err);
      return NextResponse.json({ error: "Failed to prepare account." }, { status: 500 });
    }
  }

  // Get Cognito sub (stable userId)
  let userId: string;
  try {
    const { UserAttributes } = await cognitoAdmin.send(
      new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email })
    );
    userId = UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";
    if (!userId) throw new Error("No sub");
  } catch {
    return NextResponse.json({ error: "Account error." }, { status: 500 });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Store OTP in DynamoDB under a special "otp#email" key (no new table needed)
  await docClient.send(
    new PutCommand({
      TableName: TABLES.USERS,
      Item: { userId: `otp#${email}`, otp, expiresAt, realUserId: userId },
    })
  );

  // Send OTP via Gmail SMTP — no sandbox, works to any recipient instantly
  try {
    await transporter.sendMail({
      from: `"SeatFinder SRM" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your SeatFinder login code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1d4ed8;margin:0 0 8px">SeatFinder SRM</h2>
          <p style="color:#374151;margin:0 0 20px">Your one-time login code:</p>
          <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#1d4ed8;padding:16px 0;border:2px dashed #93c5fd;border-radius:8px;text-align:center">${otp}</div>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">Valid for 5 minutes. Do not share this code with anyone.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Failed to send OTP email." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
