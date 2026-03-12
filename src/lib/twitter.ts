import { postTweetViaTwikit, postThreadViaTwikit, searchTweetsViaTwikit, sendDMViaTwikit } from "./twikit";

// ---------------------------------------------------------------------------
// Cookie types — supports full jar export or simple ct0+auth_token
// ---------------------------------------------------------------------------
interface BrowserCookie {
  name: string;
  value: string;
  [key: string]: unknown;
}

interface StoredCookies {
  cookieJar?: BrowserCookie[];
  ct0: string;
  auth_token: string;
}

// ---------------------------------------------------------------------------
// Anti-ban: rate-limit tracking
// ---------------------------------------------------------------------------
const recentActions: number[] = [];
const MAX_ACTIONS_PER_HOUR = 15;
const MIN_GAP_MS = 3_000;

function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, Math.round(ms)));
}

function enforceRateLimit() {
  const now = Date.now();
  while (recentActions.length > 0 && now - recentActions[0] > 3_600_000) {
    recentActions.shift();
  }
  if (recentActions.length >= MAX_ACTIONS_PER_HOUR) {
    const waitMin = Math.ceil((3_600_000 - (now - recentActions[0])) / 60_000);
    throw new Error(
      `Rate limit: ${MAX_ACTIONS_PER_HOUR} tweets/hour reached. ` +
      `Try again in ~${waitMin} minutes to avoid a ban.`
    );
  }
  if (recentActions.length > 0) {
    const lastAction = recentActions[recentActions.length - 1];
    if (now - lastAction < MIN_GAP_MS) {
      throw new Error("Too fast — wait a few seconds between actions.");
    }
  }
}

function recordAction() {
  recentActions.push(Date.now());
}

// Removed unused GraphQL/TransactionID logic since we use Twikit for posting and searching now

// ---------------------------------------------------------------------------
// Post a single tweet
// ---------------------------------------------------------------------------
export async function postTweet(
  text: string,
  replyToId?: string
): Promise<{ id: string; text: string }> {
  // Delegated to Twikit Python sidecar (cookie-based, avoids GraphQL bot detection)
  return postTweetViaTwikit(text, replyToId);
}

// ---------------------------------------------------------------------------
// Post a thread
// ---------------------------------------------------------------------------
export async function postThread(
  tweets: string[]
): Promise<{ ids: string[]; count: number }> {
  // Delegated to Twikit Python sidecar (cookie-based, avoids GraphQL bot detection)
  return postThreadViaTwikit(tweets);
}

// ---------------------------------------------------------------------------
// Search tweets
// ---------------------------------------------------------------------------
export async function searchTweets(
  query: string,
  count: number = 20
): Promise<
  Array<{
    id: string;
    text: string;
    author: string;
    authorHandle: string;
    createdAt: string;
    replyCount: number;
    retweetCount: number;
    likeCount: number;
    url: string;
  }>
> {
  return searchTweetsViaTwikit(query, count) as Promise<
    Array<{
      id: string;
      text: string;
      author: string;
      authorHandle: string;
      createdAt: string;
      replyCount: number;
      retweetCount: number;
      likeCount: number;
      url: string;
    }>
  >;
}

// ---------------------------------------------------------------------------
// Send Direct Message
// ---------------------------------------------------------------------------
export async function sendTwitterDM(
  username: string,
  text: string
): Promise<{ dm_id: string; text: string }> {
  // Delegated to Twikit Python sidecar
  return sendDMViaTwikit(username, text);
}

// ---------------------------------------------------------------------------
// Cookie management for verification
// ---------------------------------------------------------------------------
function parseCookieData(raw: string): StoredCookies {
  const parsed = JSON.parse(raw);

  // Array — raw browser export
  if (Array.isArray(parsed)) {
    const jar = parsed as BrowserCookie[];
    const ct0 = jar.find((c) => c.name === "ct0")?.value || "";
    const authToken = jar.find((c) => c.name === "auth_token")?.value || "";
    return { cookieJar: jar, ct0, auth_token: authToken };
  }

  // Object with cookieJar array
  if (parsed.cookieJar && Array.isArray(parsed.cookieJar)) {
    const jar = parsed.cookieJar as BrowserCookie[];
    const ct0 = parsed.ct0 || jar.find((c) => c.name === "ct0")?.value || "";
    const authToken =
      parsed.auth_token || jar.find((c) => c.name === "auth_token")?.value || "";
    return { cookieJar: jar, ct0, auth_token: authToken };
  }

  // Legacy { ct0, auth_token }
  return { ct0: parsed.ct0 || "", auth_token: parsed.auth_token || "" };
}

function buildCookieString(cookies: StoredCookies): string {
  if (cookies.cookieJar && cookies.cookieJar.length > 0) {
    return cookies.cookieJar
      .filter((c) => c.name && c.value)
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }
  return `ct0=${cookies.ct0}; auth_token=${cookies.auth_token}`;
}

// ---------------------------------------------------------------------------
// Verify cookies — lenient
// ---------------------------------------------------------------------------
export async function verifyTwitterCookies(
  cookieData: string
): Promise<{ valid: boolean; username?: string; cookieCount?: number }> {
  let cookies: StoredCookies;
  try {
    cookies = parseCookieData(cookieData);
  } catch {
    return { valid: false };
  }

  if (!cookies.ct0 || !cookies.auth_token) {
    return { valid: false };
  }

  const cookieCount = cookies.cookieJar?.length || 2;

  const txId = "fallback-tx-id";

  const headers = {
    authorization: `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
    "content-type": "application/json",
    "x-csrf-token": cookies.ct0,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
    "x-client-uuid": "12345678-1234-1234-1234-123456789012",
    "x-client-transaction-id": txId,
    cookie: buildCookieString(cookies),
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept: "*/*",
  };

  try {
    const response = await fetch(
      "https://x.com/i/api/1.1/account/settings.json",
      { headers }
    );

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data?.screen_name, cookieCount };
    }
    if (response.status === 401) {
      return { valid: false, cookieCount };
    }
    console.warn(
      `[Twitter] Verification returned ${response.status} — accepting`
    );
    return { valid: true, username: undefined, cookieCount };
  } catch (err) {
    console.warn("[Twitter] Verification network error — accepting:", err);
    return { valid: true, username: undefined, cookieCount };
  }
}

// ---------------------------------------------------------------------------
// Rate-limit status for the UI
// ---------------------------------------------------------------------------
export function getRateLimitStatus(): {
  actionsThisHour: number;
  maxPerHour: number;
  canPost: boolean;
} {
  const now = Date.now();
  while (recentActions.length > 0 && now - recentActions[0] > 3_600_000) {
    recentActions.shift();
  }
  return {
    actionsThisHour: recentActions.length,
    maxPerHour: MAX_ACTIONS_PER_HOUR,
    canPost: recentActions.length < MAX_ACTIONS_PER_HOUR,
  };
}
