/**
 * twikit.ts — Node.js bridge to the Python Twikit sidecar
 *
 * Spawns scripts/twikit_bridge.py (inside the scripts/venv virtualenv),
 * sends a JSON payload on stdin, reads the JSON result from stdout.
 *
 * Exported API mirrors the old GraphQL-based twitter.ts:
 *   postTweetViaTwikit(text, replyToId?)  → { id, text }
 *   postThreadViaTwikit(tweets[])         → { ids[], count }
 */

import { spawn } from "child_process";
import path from "path";
import { db } from "./db";

// ---------------------------------------------------------------------------
// Cookie helpers — reads from local SQLite (same as twitter.ts getCookies)
// ---------------------------------------------------------------------------
interface CookieData {
    auth_token: string;
    ct0: string;
    [key: string]: string;
}

async function getTwikitCookies(): Promise<CookieData> {
    const account = await db.socialAccount.findUnique({
        where: { platform: "twitter" },
    });

    if (!account || account.status === "expired") {
        throw new Error(
            "Twitter account not connected. Add your cookies in Social settings."
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(account.cookies);
    } catch {
        throw new Error("Stored Twitter cookies are not valid JSON.");
    }

    // Support either array (browser export) or plain dict
    if (Array.isArray(parsed)) {
        const jar = parsed as Array<{ name: string; value: string }>;
        const find = (name: string) =>
            jar.find((c) => c.name === name)?.value || "";
        const auth_token = find("auth_token");
        const ct0 = find("ct0");
        if (!auth_token || !ct0)
            throw new Error("Cookies array missing auth_token or ct0.");
        return { auth_token, ct0 };
    }

    if (
        typeof parsed === "object" &&
        parsed !== null &&
        "auth_token" in parsed &&
        "ct0" in parsed
    ) {
        const obj = parsed as CookieData;
        if (!obj.auth_token || !obj.ct0)
            throw new Error("Cookie object missing auth_token or ct0.");
        return obj;
    }

    throw new Error(
        "Unrecognized cookie format — expected {auth_token, ct0} or a cookie array."
    );
}

// ---------------------------------------------------------------------------
// Core: spawn the Python bridge and get a JSON result
// ---------------------------------------------------------------------------
function projectRoot(): string {
    // process.cwd() is always the project root under Next.js dev/start.
    // __dirname resolves to .next/server/app/ at runtime, so we avoid it.
    return process.cwd();
}

interface BridgePayload {
    action: "tweet" | "reply" | "thread" | "search" | "dm";
    text?: string;
    reply_to?: string;
    tweets?: string[];
    query?: string;
    target_username?: string;
    count?: number;
    cookies: CookieData;
}

interface BridgeResult {
    success: boolean;
    tweet_id?: string;
    tweet_ids?: string[];
    dm_id?: string;
    count?: number;
    error?: string;
    ids_so_far?: string[];
    tweets?: Array<{
        id: string;
        text: string;
        author: string;
        authorHandle: string;
        createdAt: string;
        replyCount: number;
        retweetCount: number;
        likeCount: number;
        url: string;
    }>;
}

function runBridge(payload: BridgePayload): Promise<BridgeResult> {
    return new Promise((resolve, reject) => {
        const root = projectRoot();
        const python = path.join(root, "scripts", "venv", "bin", "python3");
        const script = path.join(root, "scripts", "twikit_bridge.py");

        const child = spawn(python, [script], {
            cwd: root,
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on("close", (code) => {
            if (stderr) {
                console.warn("[Twikit] Python stderr:", stderr.trim());
            }
            const raw = stdout.trim();
            if (!raw) {
                reject(
                    new Error(
                        `Twikit bridge produced no output (exit ${code}). stderr: ${stderr.slice(0, 300)}`
                    )
                );
                return;
            }
            try {
                const result: BridgeResult = JSON.parse(raw);
                resolve(result);
            } catch {
                reject(
                    new Error(`Twikit bridge returned non-JSON: ${raw.slice(0, 300)}`)
                );
            }
        });

        child.on("error", (err) => {
            reject(
                new Error(
                    `Failed to spawn twikit_bridge.py: ${err.message}. ` +
                    `Make sure scripts/venv exists (run: python3 -m venv scripts/venv && scripts/venv/bin/pip install twikit)`
                )
            );
        });

        // Write payload and close stdin
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}

// ---------------------------------------------------------------------------
// Anti-ban: mirror the same rate-limit guard as the old twitter.ts
// ---------------------------------------------------------------------------
const recentActions: number[] = [];
const MAX_ACTIONS_PER_HOUR = 15;
const MIN_GAP_MS = 3_000;

function enforceRateLimit() {
    const now = Date.now();
    while (recentActions.length > 0 && now - recentActions[0] > 3_600_000) {
        recentActions.shift();
    }
    if (recentActions.length >= MAX_ACTIONS_PER_HOUR) {
        const waitMin = Math.ceil(
            (3_600_000 - (now - recentActions[0])) / 60_000
        );
        throw new Error(
            `Rate limit: ${MAX_ACTIONS_PER_HOUR} tweets/hour. Try again in ~${waitMin} minutes.`
        );
    }
    if (
        recentActions.length > 0 &&
        now - recentActions[recentActions.length - 1] < MIN_GAP_MS
    ) {
        throw new Error("Too fast — wait a few seconds between actions.");
    }
}

function recordAction() {
    recentActions.push(Date.now());
}

function humanDelay(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.random() * (maxMs - minMs);
    return new Promise((r) => setTimeout(r, Math.round(ms)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function postTweetViaTwikit(
    text: string,
    replyToId?: string
): Promise<{ id: string; text: string }> {
    // Note: X Premium allows up to 25,000 chars — let Twitter enforce limits natively.
    enforceRateLimit();

    const cookies = await getTwikitCookies();

    const payload: BridgePayload = {
        action: replyToId ? "reply" : "tweet",
        text,
        cookies,
        ...(replyToId ? { reply_to: replyToId } : {}),
    };

    const result = await runBridge(payload);

    if (!result.success) {
        const errMsg = result.error || "Unknown Twikit error";

        // Only mark cookies expired for genuine auth failures.
        // Error 344 = daily tweet limit, 187 = duplicate tweet, etc. — NOT bad cookies.
        const isRealAuthFailure =
            /auth_token|login required|could not authenticate|invalid.*token/i.test(errMsg) &&
            !/daily limit|rate limit|duplicate|187|344/i.test(errMsg);

        if (isRealAuthFailure) {
            await db.socialAccount
                .update({
                    where: { platform: "twitter" },
                    data: { status: "expired" },
                })
                .catch(() => { });
            throw new Error(
                "Twitter cookies may be expired. Update them in Social settings. " +
                `(Twikit: ${errMsg})`
            );
        }
        throw new Error(`Twikit: ${errMsg}`);
    }

    recordAction();
    const tweetId = result.tweet_id!;
    console.log(
        `[Twikit] Posted tweet ${tweetId} — https://x.com/i/status/${tweetId}`
    );
    return { id: tweetId, text };
}

export async function postThreadViaTwikit(
    tweets: string[]
): Promise<{ ids: string[]; count: number }> {
    if (tweets.length === 0) throw new Error("Thread is empty.");
    if (tweets.length > 25)
        throw new Error(`Thread has ${tweets.length} tweets — max 25 to stay safe.`);

    enforceRateLimit();

    const cookies = await getTwikitCookies();

    // Send the ENTIRE thread to one Python process — it handles reply chaining internally.
    // This is faster (one process startup) and more reliable than spawning N processes.
    const result = await runBridge({ action: "thread", tweets, cookies });

    if (!result.success) {
        const errMsg = result.error || "Unknown Twikit error";
        const soFar = result.ids_so_far?.length ?? 0;
        const suffix = soFar > 0 ? ` (${soFar}/${tweets.length} tweet(s) posted before error)` : "";

        const isRealAuthFailure =
            /auth_token|login required|could not authenticate|invalid.*token/i.test(errMsg) &&
            !/daily limit|rate limit|duplicate|187|344/i.test(errMsg);

        if (isRealAuthFailure) {
            await db.socialAccount
                .update({ where: { platform: "twitter" }, data: { status: "expired" } })
                .catch(() => { });
            throw new Error(
                `Twitter cookies may be expired. Update them in Social settings. (Twikit: ${errMsg})${suffix}`
            );
        }
        throw new Error(`Twikit thread failed: ${errMsg}${suffix}`);
    }

    const ids = result.tweet_ids ?? [];
    ids.forEach((id, i) =>
        console.log(`[Twikit] Thread tweet ${i + 1}/${ids.length}: https://x.com/i/status/${id}`)
    );
    // Record each tweet in the rate-limit tracker
    ids.forEach(() => recordAction());

    return { ids, count: ids.length };
}

export async function searchTweetsViaTwikit(
    query: string,
    count: number = 20
): Promise<BridgeResult["tweets"]> {
    enforceRateLimit();
    recordAction();

    const cookies = await getTwikitCookies();
    const result = await runBridge({ action: "search", query, count, cookies });

    if (!result.success) {
        const errMsg = result.error || "Unknown Twikit search error";
        throw new Error(`Twikit search failed: ${errMsg}`);
    }

    return result.tweets ?? [];
}

export async function sendDMViaTwikit(
    target_username: string,
    text: string
): Promise<{ dm_id: string; text: string }> {
    enforceRateLimit();
    recordAction();

    const cookies = await getTwikitCookies();
    const result = await runBridge({
        action: "dm",
        target_username,
        text,
        cookies,
    });

    if (!result.success) {
        const errMsg = result.error || "Unknown Twikit DM error";

        const isRealAuthFailure =
            /auth_token|login required|could not authenticate|invalid.*token/i.test(errMsg) &&
            !/daily limit|rate limit|duplicate|187|344/i.test(errMsg);

        if (isRealAuthFailure) {
            await db.socialAccount
                .update({
                    where: { platform: "twitter" },
                    data: { status: "expired" },
                })
                .catch(() => { });
            throw new Error(
                "Twitter cookies may be expired. Update them in Social settings. " +
                `(Twikit: ${errMsg})`
            );
        }
        throw new Error(`Twikit DM failed: ${errMsg}`);
    }

    const dmId = result.dm_id!;
    console.log(`[Twikit] Sent DM to ${target_username} (${dmId})`);
    return { dm_id: dmId, text };
}
