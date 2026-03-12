import { NextResponse } from "next/server";
import { refreshTokenIfNeeded } from "@/lib/instagram-api";

// POST — Refresh Instagram OAuth token if expiring soon
export async function POST() {
  try {
    const result = await refreshTokenIfNeeded();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to refresh token" },
      { status: 500 }
    );
  }
}
