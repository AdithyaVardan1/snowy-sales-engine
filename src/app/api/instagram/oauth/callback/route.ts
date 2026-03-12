import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCodeForToken } from "@/lib/instagram-api";
import crypto from "crypto";

// GET — OAuth callback from Instagram
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/instagram?oauth_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/instagram?oauth_error=missing_params", request.url)
    );
  }

  // Strip trailing #_ that Instagram appends
  const cleanCode = code.replace(/#_$/, "");

  try {
    // Find the pending token record
    const pending = await db.instagramOAuthToken.findUnique({
      where: { pageId: `pending_${state}` },
    });

    if (!pending) {
      return NextResponse.redirect(
        new URL("/dashboard/instagram?oauth_error=invalid_state", request.url)
      );
    }

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/instagram/oauth/callback`;

    // Exchange code for tokens
    const result = await exchangeCodeForToken(
      cleanCode,
      pending.appId,
      pending.appSecret,
      redirectUri
    );

    // Deactivate any existing active tokens
    await db.instagramOAuthToken.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Delete the pending record
    await db.instagramOAuthToken.delete({
      where: { pageId: `pending_${state}` },
    });

    // Create the real token record
    await db.instagramOAuthToken.create({
      data: {
        pageId: result.userId, // Use IG user ID as pageId
        igUserId: result.userId,
        appId: pending.appId,
        appSecret: pending.appSecret,
        accessToken: result.accessToken,
        tokenExpiresAt: result.expiresAt,
        webhookVerifyToken: pending.webhookVerifyToken || crypto.randomUUID(),
        isActive: true,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/instagram?oauth_success=true", request.url)
    );
  } catch (err: any) {
    console.error("Instagram OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/instagram?oauth_error=${encodeURIComponent(err.message || "token_exchange_failed")}`,
        request.url
      )
    );
  }
}
