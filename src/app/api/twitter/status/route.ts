import { NextResponse } from "next/server";
import { getRateLimitStatus } from "@/lib/twitter";

export async function GET() {
  const status = getRateLimitStatus();
  return NextResponse.json(status);
}
