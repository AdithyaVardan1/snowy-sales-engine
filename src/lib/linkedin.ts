/**
 * LinkedIn posting via the official Share API (OAuth 2.0).
 *
 * Setup (one-time):
 * 1. Go to linkedin.com/developers → create app → add "Share on LinkedIn" product
 * 2. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env.local
 * 3. Call GET /api/social/linkedin-auth to get the authorization URL
 * 4. Complete the OAuth flow — the callback stores the token automatically
 * 5. Set LINKEDIN_PERSON_URN (looks like urn:li:person:XXXXXXXX)
 *    → Get it by calling GET /api/social/linkedin-me after connecting
 *
 * The access token is stored in the SocialAccount table and refreshed automatically.
 */

import { db } from "./db";
import { getSetting } from "./config";

// ─────────────────────────────────────────────
// Token management
// ─────────────────────────────────────────────

export async function getLinkedInToken(accountId?: string): Promise<string> {
  let account;
  if (accountId) {
    account = await db.socialAccount.findUnique({ where: { id: accountId } });
  } else {
    account = await db.socialAccount.findFirst({
      where: { platform: "linkedin", isDefault: true, status: "active" },
    }) || await db.socialAccount.findFirst({
      where: { platform: "linkedin", status: "active" },
    });
  }

  if (account && account.status === "active") {
    const cookies = JSON.parse(account.cookies) as { access_token?: string };
    if (cookies.access_token) return cookies.access_token;
  }

  // Fall back to AppSetting table (set via Settings page) or env var
  const envToken = await getSetting("LINKEDIN_ACCESS_TOKEN");
  if (envToken) return envToken;

  throw new Error(
    "LinkedIn not connected. Complete OAuth flow or add your token in Settings."
  );
}

/** Get all active LinkedIn accounts */
export async function getAllLinkedInAccounts() {
  return db.socialAccount.findMany({
    where: { platform: "linkedin", status: "active" },
  });
}

export async function saveLinkedInToken(
  accessToken: string,
  expiresIn: number,
  username?: string,
  personUrn?: string,
  label?: string
): Promise<void> {
  const payload = JSON.stringify({ access_token: accessToken, expires_in: expiresIn, person_urn: personUrn });
  const accountLabel = label || username || "default";
  await db.socialAccount.upsert({
    where: { platform_label: { platform: "linkedin", label: accountLabel } },
    create: {
      platform: "linkedin",
      label: accountLabel,
      cookies: payload,
      username: username ?? "",
      status: "active",
      isDefault: true,
    },
    update: {
      cookies: payload,
      status: "active",
      username: username ?? undefined,
    },
  });
}

// ─────────────────────────────────────────────
// Posting
// ─────────────────────────────────────────────

async function getPersonUrn(accountId?: string): Promise<string> {
  // Try to get personUrn from the account's stored credentials
  if (accountId) {
    const account = await db.socialAccount.findUnique({ where: { id: accountId } });
    if (account) {
      const creds = JSON.parse(account.cookies) as { person_urn?: string };
      if (creds.person_urn) return creds.person_urn;
    }
  } else {
    // Check default account
    const account = await db.socialAccount.findFirst({
      where: { platform: "linkedin", isDefault: true, status: "active" },
    }) || await db.socialAccount.findFirst({
      where: { platform: "linkedin", status: "active" },
    });
    if (account) {
      const creds = JSON.parse(account.cookies) as { person_urn?: string };
      if (creds.person_urn) return creds.person_urn;
    }
  }

  // Fall back to global setting
  const urn = await getSetting("LINKEDIN_PERSON_URN");
  if (!urn) {
    throw new Error(
      "LINKEDIN_PERSON_URN not set. After connecting, call /api/social/linkedin-me to get it, then add it in Settings."
    );
  }
  return urn;
}

export async function postLinkedInUpdate(
  text: string,
  accountId?: string
): Promise<{ success: boolean; id?: string }> {
  const token = await getLinkedInToken(accountId);
  const personUrn = await getPersonUrn(accountId);

  const payload = {
    author: personUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[LinkedIn] POST /v2/ugcPosts failed ${response.status}:`, errText);

    // Mark token as expired so the UI prompts re-auth
    if (response.status === 401) {
      if (accountId) {
        await db.socialAccount.update({ where: { id: accountId }, data: { status: "expired" } }).catch(() => { });
      } else {
        const acct = await db.socialAccount.findFirst({ where: { platform: "linkedin", isDefault: true } });
        if (acct) await db.socialAccount.update({ where: { id: acct.id }, data: { status: "expired" } }).catch(() => { });
      }
      throw new Error("LinkedIn token expired. Please re-authenticate.");
    }

    throw new Error(`LinkedIn API error ${response.status}: ${errText}`);
  }


  // LinkedIn returns the post URN in the x-restli-id header
  const postId = response.headers.get("x-restli-id") || "";
  return { success: true, id: postId };
}

// ─────────────────────────────────────────────
// OAuth helpers
// ─────────────────────────────────────────────

export async function getLinkedInAuthUrl(redirectUri: string): Promise<string> {
  const clientId = await getSetting("LINKEDIN_CLIENT_ID");
  if (!clientId) throw new Error("LINKEDIN_CLIENT_ID not set. Add it in Settings.");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email w_member_social",
    state: "snowy-ai-linkedin",
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeLinkedInCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = await getSetting("LINKEDIN_CLIENT_ID");
  const clientSecret = await getSetting("LINKEDIN_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not set. Add them in Settings.");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${errText}`);
  }

  return res.json();
}

export async function getLinkedInMe(token: string): Promise<{ sub: string; name: string; urn: string }> {
  // Strategy 1: OpenID Connect userinfo — works with openid+profile scopes
  // (no extra LinkedIn app product required)
  const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (userinfoRes.ok) {
    const data = await userinfoRes.json();
    const sub = data.sub as string;
    const name = (data.name as string) ?? `${data.given_name ?? ""} ${data.family_name ?? ""}`.trim();
    return { sub, name, urn: `urn:li:person:${sub}` };
  }

  // Strategy 2: /v2/me — requires "Sign In with LinkedIn" product on the app
  const meRes = await fetch("https://api.linkedin.com/v2/me", {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  if (meRes.ok) {
    const data = await meRes.json();
    const id = data.id as string;
    const name = `${data.localizedFirstName ?? ""} ${data.localizedLastName ?? ""}`.trim();
    return { sub: id, name, urn: `urn:li:person:${id}` };
  }

  throw new Error(
    `Failed to fetch LinkedIn profile. ` +
    `Ensure your token has 'openid' + 'profile' + 'w_member_social' scopes. ` +
    `userinfo: ${userinfoRes.status}, me: ${meRes.status}`
  );
}


/** @deprecated Use postLinkedInUpdate() with OAuth token instead */
export async function verifyLinkedInCookies(
  _liAt: string,
  _jsessionId: string
): Promise<{ valid: boolean; name?: string }> {
  // Old cookie method no longer reliable — use OAuth flow
  return { valid: false };
}
