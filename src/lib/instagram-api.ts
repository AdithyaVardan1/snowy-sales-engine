/**
 * Official Instagram API with Instagram Login — for interactive DMs.
 * Uses the new Instagram-native OAuth (no Facebook Page needed).
 * Scopes: instagram_business_basic, instagram_business_manage_messages,
 *         instagram_business_manage_comments
 *
 * Separate from instagram.ts (instagrapi bridge).
 */

import { db } from "./db";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const IG_OAUTH_BASE = "https://api.instagram.com";
const RATE_LIMIT_PER_HOUR = 200;

// ── OAuth Helpers ──────────────────────────────────────────────────────────

/**
 * Build the Instagram OAuth authorization URL.
 * User visits this to grant permissions — no Facebook Page needed.
 */
export function getAuthorizationUrl(appId: string, redirectUri: string, state?: string): string {
  const scopes = [
    "instagram_business_basic",
    "instagram_business_manage_messages",
    "instagram_business_manage_comments",
  ].join(",");

  const url = new URL(`${IG_OAUTH_BASE}/oauth/authorize`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");
  if (state) url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Exchange authorization code for a short-lived token, then for a long-lived one.
 */
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; userId: string; expiresAt: Date }> {
  // Step 1: Exchange code for short-lived token
  const shortRes = await fetch(`${IG_OAUTH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  const shortData = await shortRes.json();
  if (shortData.error_message || shortData.error) {
    throw new Error(shortData.error_message || shortData.error?.message || "Token exchange failed");
  }

  const shortLivedToken = shortData.access_token;
  const userId = String(shortData.user_id);

  // Step 2: Exchange short-lived for long-lived token (60 days)
  const longUrl = new URL(`${GRAPH_API_BASE}/access_token`);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", shortLivedToken);

  const longRes = await fetch(longUrl.toString());
  const longData = await longRes.json();

  if (longData.error) {
    throw new Error(longData.error.message || "Long-lived token exchange failed");
  }

  const expiresAt = new Date(Date.now() + (longData.expires_in || 5184000) * 1000);

  return {
    accessToken: longData.access_token,
    userId,
    expiresAt,
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface QuickReply {
  type: "text";
  title: string;
  payload: string;
}

export interface TemplateButton {
  type: "web_url" | "postback";
  title: string;
  url?: string;
  payload?: string;
}

export interface TemplateElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  buttons: TemplateButton[];
}

interface SendApiResponse {
  recipient_id: string;
  message_id: string;
}

interface GraphApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

// ── Token Management ───────────────────────────────────────────────────────

export async function getActiveToken() {
  const token = await db.instagramOAuthToken.findFirst({
    where: { isActive: true },
  });
  if (!token) {
    throw new Error("No active Instagram OAuth token configured. Set up the Official API in Settings.");
  }
  return token;
}

export async function refreshTokenIfNeeded(): Promise<{ refreshed: boolean; expiresAt: Date | null }> {
  const token = await getActiveToken();

  if (!token.tokenExpiresAt) {
    return { refreshed: false, expiresAt: null };
  }

  const daysUntilExpiry = (token.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry > 7) {
    return { refreshed: false, expiresAt: token.tokenExpiresAt };
  }

  // Refresh via Instagram Graph API (ig_refresh_token)
  const url = new URL(`${GRAPH_API_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token.accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error.message}`);
  }

  const newExpiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000); // default 60 days

  await db.instagramOAuthToken.update({
    where: { id: token.id },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt: newExpiresAt,
    },
  });

  return { refreshed: true, expiresAt: newExpiresAt };
}

// ── Rate Limiting ──────────────────────────────────────────────────────────

export async function checkRateLimit(): Promise<{ allowed: boolean; remaining: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const count = await db.instagramCommentLog.count({
    where: {
      dmSent: true,
      dmSentAt: { gte: oneHourAgo },
    },
  });

  return {
    allowed: count < RATE_LIMIT_PER_HOUR,
    remaining: Math.max(0, RATE_LIMIT_PER_HOUR - count),
  };
}

export async function checkUserCooldown(igUserId: string): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentDm = await db.instagramCommentLog.findFirst({
    where: {
      igUserId,
      dmSent: true,
      dmSentAt: { gte: twentyFourHoursAgo },
    },
  });

  return !!recentDm; // true = on cooldown
}

// ── Send Functions ─────────────────────────────────────────────────────────

async function callSendApi(igUserId: string, message: Record<string, unknown>): Promise<SendApiResponse> {
  const token = await getActiveToken();

  const url = `${GRAPH_API_BASE}/${token.igUserId}/messages`;

  const body = {
    recipient: { id: igUserId },
    message,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    const err = data as GraphApiError;
    if (err.error.code === 190) {
      // Token expired — mark as needs refresh
      await db.instagramOAuthToken.update({
        where: { id: token.id },
        data: { tokenExpiresAt: new Date() },
      });
    }
    throw new Error(`Instagram API error (${err.error.code}): ${err.error.message}`);
  }

  return data as SendApiResponse;
}

export async function sendTextDM(igUserId: string, text: string): Promise<SendApiResponse> {
  return callSendApi(igUserId, { text });
}

export async function sendQuickReplyDM(
  igUserId: string,
  text: string,
  quickReplies: QuickReply[]
): Promise<SendApiResponse> {
  return callSendApi(igUserId, {
    text,
    quick_replies: quickReplies,
  });
}

export async function sendTemplateDM(
  igUserId: string,
  elements: TemplateElement[]
): Promise<SendApiResponse> {
  return callSendApi(igUserId, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements,
      },
    },
  });
}

/**
 * Send a DM from a trigger's stored messagePayload JSON.
 * Replaces {{username}} placeholders before sending.
 */
export async function sendMessageFromPayload(
  igUserId: string,
  messagePayload: string,
  username?: string
): Promise<SendApiResponse> {
  let payloadStr = messagePayload;

  // Replace {{username}} placeholder
  if (username) {
    payloadStr = payloadStr.replace(/\{\{username\}\}/g, username);
  }

  const message = JSON.parse(payloadStr);
  return callSendApi(igUserId, message);
}
