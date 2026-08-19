import { NextResponse } from "next/server";

// Firebase init route — superseded by DynamoDB infrastructure scripts.
export async function GET() {
  return NextResponse.json({ message: "Use infrastructure/create-tables.mjs to initialize DynamoDB tables." });
}
