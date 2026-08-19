import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface AdminVerifyResult {
  authorized: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

export async function verifyAdmin(request: NextRequest): Promise<AdminVerifyResult> {
  const token =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.cookies.get("accessToken")?.value;

  if (!token) return { authorized: false, error: "No token provided" };

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.isAdmin) {
      return { authorized: false, error: "Insufficient privileges" };
    }
    return { authorized: true, userId: payload.sub, email: payload.email as string };
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") {
      return { authorized: false, error: "Token expired" };
    }
    return { authorized: false, error: "Invalid or expired token" };
  }
}

/** Returns a 401/403 NextResponse if not an admin, or null if authorized. */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const result = await verifyAdmin(request);
  if (!result.authorized) {
    const unauthErrors = ["No token provided", "Token expired", "Invalid or expired token"];
    const status = unauthErrors.includes(result.error ?? "") ? 401 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }
  return null;
}

/** Returns a 401/403 NextResponse if not a valid user, or null if authorized. */
export async function requireUser(request: NextRequest): Promise<NextResponse | null> {
  const result = await verifyUser(request);
  if (!result.valid) {
    const unauthErrors = ["No token provided", "Token expired", "Invalid or expired token"];
    const status = unauthErrors.includes(result.error ?? "") ? 401 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }
  return null;
}

export async function verifyUser(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const token =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.cookies.get("accessToken")?.value;

  if (!token) return { valid: false, error: "No token provided" };

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { valid: true, userId: payload.sub, email: payload.email as string };
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") {
      return { valid: false, error: "Token expired" };
    }
    return { valid: false, error: "Invalid or expired token" };
  }
}
