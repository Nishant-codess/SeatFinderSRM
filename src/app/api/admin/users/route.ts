import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/verify-admin";
import { searchUsers } from "@/services/user-management";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const q = request.nextUrl.searchParams.get("query") ?? "";
    const users = await searchUsers(q);
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
