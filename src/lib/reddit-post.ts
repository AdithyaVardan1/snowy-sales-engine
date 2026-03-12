/**
 * Reddit posting via browser session cookies (no API key needed).
 *
 * How to get your cookies (takes 2 minutes):
 * 1. Open reddit.com in Chrome and log in to your account
 * 2. Open DevTools → Application → Cookies → https://www.reddit.com
 * 3. Copy the value of "reddit_session"
 * 4. Add to .env.local:
 *      REDDIT_SESSION_COOKIE=<value>
 *      (optionally also REDDIT_USER_AGENT if you want a custom one)
 *
 * Anti-detection measures built in:
 *  - Random delays between requests (2–5s)
 *  - Realistic browser User-Agent
 *  - Modhash fetched fresh per request (proper CSRF token)
 *  - Uses www.reddit.com (not old.reddit.com) to blend in
 */

import { getSetting } from "./config";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(minMs = 2000, maxMs = 5000): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return delay(ms);
}

const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function getSessionCookie(): Promise<string> {
    const cookie = await getSetting("REDDIT_SESSION_COOKIE");
    if (!cookie) {
        throw new Error(
            "REDDIT_SESSION_COOKIE not configured. Go to Settings → Reddit and paste your reddit_session cookie."
        );
    }
    return cookie;
}

function buildCookieHeader(sessionCookie: string): string {
    // reddit_session is URL-encoded — pass as-is
    return `reddit_session=${sessionCookie}`;
}

// ─────────────────────────────────────────────
// Modhash (CSRF token)  — fetch once per session
// ─────────────────────────────────────────────

let cachedModhash: string | null = null;

async function getModhash(): Promise<string> {
    if (cachedModhash) return cachedModhash;

    const session = await getSessionCookie();
    const res = await fetch("https://www.reddit.com/api/me.json", {
        headers: {
            "User-Agent": USER_AGENT,
            Cookie: buildCookieHeader(session),
            Accept: "application/json",
        },
    });

    if (!res.ok) {
        // Session expired
        throw new Error(
            `Reddit session invalid (status ${res.status}). Refresh REDDIT_SESSION_COOKIE in .env.local`
        );
    }

    const data = await res.json();
    const modhash = data?.data?.modhash as string | undefined;
    if (!modhash) {
        throw new Error("Could not retrieve Reddit modhash. Session may be expired.");
    }

    cachedModhash = modhash;
    return modhash;
}

/** Call this if you get a 403 or auth error to force modhash refresh */
function clearModhashCache(): void {
    cachedModhash = null;
}

// ─────────────────────────────────────────────
// Posting
// ─────────────────────────────────────────────

export interface RedditPostOptions {
    subreddit: string; // e.g. "selfhosted"  (without r/)
    title: string;
    /** Text/self post body */
    text?: string;
    /** Link post URL — mutually exclusive with text */
    url?: string;
    /** Flair ID if the subreddit requires it */
    flairId?: string;
}

export interface RedditPostResult {
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
}

export async function postToReddit(opts: RedditPostOptions): Promise<RedditPostResult> {
    if (!opts.text && !opts.url) {
        throw new Error("Either text (self post) or url (link post) is required");
    }

    const session = await getSessionCookie();
    const modhash = await getModhash();

    // Small human-like pause before posting
    await randomDelay(2000, 4000);

    const kind = opts.url ? "link" : "self";

    const formData = new URLSearchParams({
        api_type: "json",
        kind,
        sr: opts.subreddit,
        title: opts.title,
        uh: modhash,
        resubmit: "true",
        sendreplies: "true",
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.url ? { url: opts.url } : {}),
        ...(opts.flairId ? { flair_id: opts.flairId } : {}),
    });

    const res = await fetch("https://www.reddit.com/api/submit", {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            Cookie: buildCookieHeader(session),
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Modhash": modhash,
            Accept: "application/json",
            Referer: `https://www.reddit.com/r/${opts.subreddit}/submit`,
            Origin: "https://www.reddit.com",
        },
        body: formData.toString(),
    });

    if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
            clearModhashCache();
            return {
                success: false,
                error: `Reddit session expired (${res.status}). Refresh REDDIT_SESSION_COOKIE in .env.local`,
            };
        }
        const errText = await res.text();
        return { success: false, error: `Reddit submit error ${res.status}: ${errText}` };
    }

    const data = await res.json();

    // Reddit wraps errors in json.errors even on 200
    const errors: string[][] = data?.json?.errors ?? [];
    if (errors.length > 0) {
        const msg = errors.map((e) => e.join(": ")).join("; ");
        // Rate limit error — suggest waiting
        if (msg.toLowerCase().includes("ratelimit") || msg.toLowerCase().includes("wait")) {
            return { success: false, error: `Rate limited: ${msg}. Wait 10 min between posts.` };
        }
        return { success: false, error: msg };
    }

    const postId: string = data?.json?.data?.id ?? "";
    const postUrl: string = data?.json?.data?.url ?? "";

    return { success: true, postId, postUrl };
}

// ─────────────────────────────────────────────
// Commenting (reply to a post or comment)
// ─────────────────────────────────────────────

export async function replyToRedditPost(
    thingId: string, // "t3_abc123" for a post, "t1_xyz" for a comment
    text: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
    const session = await getSessionCookie();
    const modhash = await getModhash();

    // Pause before replying — looks more human
    await randomDelay(3000, 6000);

    const formData = new URLSearchParams({
        api_type: "json",
        thing_id: thingId,
        text,
        uh: modhash,
    });

    const res = await fetch("https://www.reddit.com/api/comment", {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            Cookie: buildCookieHeader(session),
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Modhash": modhash,
            Accept: "application/json",
            Origin: "https://www.reddit.com",
        },
        body: formData.toString(),
    });

    if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
            clearModhashCache();
            return { success: false, error: "Reddit session expired. Refresh REDDIT_SESSION_COOKIE." };
        }
        const errText = await res.text();
        return { success: false, error: `Reddit comment error ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const errors: string[][] = data?.json?.errors ?? [];
    if (errors.length > 0) {
        return { success: false, error: errors.map((e) => e.join(": ")).join("; ") };
    }

    const commentId: string = data?.json?.data?.things?.[0]?.data?.id ?? "";
    return { success: true, commentId };
}

// ─────────────────────────────────────────────
// Verify session
// ─────────────────────────────────────────────

export async function verifyRedditCredentials(): Promise<{
    valid: boolean;
    username?: string;
    karma?: number;
    error?: string;
}> {
    try {
        const session = await getSessionCookie();
        clearModhashCache(); // force fresh fetch

        const res = await fetch("https://www.reddit.com/api/me.json", {
            headers: {
                "User-Agent": USER_AGENT,
                Cookie: buildCookieHeader(session),
                Accept: "application/json",
            },
        });

        if (!res.ok) {
            return { valid: false, error: `Status ${res.status} — session may be expired` };
        }

        const data = await res.json();
        const name = data?.data?.name as string | undefined;
        const karma = ((data?.data?.link_karma ?? 0) + (data?.data?.comment_karma ?? 0)) as number;

        if (!name) return { valid: false, error: "Could not read username — session expired?" };

        // Cache the modhash from this response
        cachedModhash = data?.data?.modhash ?? null;

        return { valid: true, username: name, karma };
    } catch (e) {
        return { valid: false, error: e instanceof Error ? e.message : String(e) };
    }
}
