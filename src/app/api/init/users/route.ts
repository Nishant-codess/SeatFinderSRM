import { NextRequest, NextResponse } from "next/server";
import { initializeUserRole } from "@/lib/user-roles";

export async function POST(request: NextRequest) {
  try {
    const { userId, email, displayName } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }
    await initializeUserRole(userId, email, displayName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error initializing user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
