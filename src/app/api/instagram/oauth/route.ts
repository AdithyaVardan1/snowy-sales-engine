import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthorizationUrl } from "@/lib/instagram-api";
import crypto from "crypto";

// GET — Generate OAuth authorization URL
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get("appId");
  const appSecret = request.nextUrl.searchParams.get("appSecret");

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "appId and appSecret are required" },
      { status: 400 }
    );
  }

  // Build redirect URI from current origin
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/instagram/oauth/callback`;
  const state = crypto.randomUUID();

  // Store app credentials temporarily for the callback
  // Use a temp record with state as pageId (will be updated on callback)
  await db.instagramOAuthToken.upsert({
    where: { pageId: `pending_${state}` },
    create: {
      pageId: `pending_${state}`,
      appId,
      appSecret,
      accessToken: "",
      webhookVerifyToken: crypto.randomUUID(),
      isActive: false,
    },
    update: {
      appId,
      appSecret,
    },
  });

  const authUrl = getAuthorizationUrl(appId, redirectUri, state);

  return NextResponse.json({ authUrl, state });
}
