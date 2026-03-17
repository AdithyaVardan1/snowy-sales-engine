/**
 * instagram.ts — Node.js bridge to the Python instagrapi sidecar
 *
 * Spawns scripts/instagrapi_bridge.py (inside the scripts/venv virtualenv),
 * sends a JSON payload on stdin, reads the JSON result from stdout.
 */

import { spawn } from "child_process";
import path from "path";
import { db } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BridgePayload {
  action: "login" | "check_session" | "get_followers" | "send_dm" | "get_user_info" | "get_user_by_username" | "get_dm_inbox" | "search_users";
  username?: string;
  password?: string;
  verification_code?: string;
  partial_session_json?: string;
  session_json?: string;
  user_id?: string;
  text?: string;
  amount?: number;
  query?: string;
}

export interface IGUserInfo {
  user_id: string;
  username: string;
  full_name: string;
  biography: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_private: boolean;
  is_business: boolean;
  profile_pic_url: string;
}

export interface IGDMConversation {
  thread_id: string;
  participants: Array<{
    user_id: string;
    username: string;
    full_name: string;
  }>;
  messages: Array<{
    id: string;
    sender_id: string;
    text: string;
    timestamp: string;
  }>;
}

interface BridgeResult {
  success: boolean;
  session_json?: string;
  username?: string;
  user_id?: string;
  valid?: boolean;
  followers?: Array<{
    user_id: string;
    username: string;
    full_name: string;
    profile_pic_url: string;
    is_private: boolean;
  }>;
  thread_id?: string;
  message_id?: string;
  follower_count?: number;
  following_count?: number;
  full_name?: string;
  profile_pic_url?: string;
  biography?: string;
  media_count?: number;
  is_private?: boolean;
  is_business?: boolean;
  conversations?: IGDMConversation[];
  users?: IGUserInfo[];
  error?: string;
  code?: string;
  partial_session_json?: string;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function getInstagramSession(accountId?: string): Promise<string> {
  let account;
  if (accountId) {
    account = await db.socialAccount.findUnique({ where: { id: accountId } });
  } else {
    account = await db.socialAccount.findFirst({
      where: { platform: "instagram", isDefault: true, status: "active" },
    }) || await db.socialAccount.findFirst({
      where: { platform: "instagram", status: "active" },
    });
  }

  if (!account || account.status === "expired") {
    throw new Error(
      "Instagram account not connected. Log in from the Instagram dashboard."
    );
  }

  return account.cookies; // session_json stored directly
}

async function markExpired(accountId?: string) {
  if (accountId) {
    await db.socialAccount.update({ where: { id: accountId }, data: { status: "expired" } }).catch(() => {});
  } else {
    const acct = await db.socialAccount.findFirst({ where: { platform: "instagram", isDefault: true } });
    if (acct) await db.socialAccount.update({ where: { id: acct.id }, data: { status: "expired" } }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Core: spawn the Python bridge
// ---------------------------------------------------------------------------

function projectRoot(): string {
  return process.cwd();
}

function runBridge(payload: BridgePayload): Promise<BridgeResult> {
  return new Promise((resolve, reject) => {
    const root = projectRoot();
    const python = path.join(root, "scripts", "venv", "bin", "python3");
    const script = path.join(root, "scripts", "instagrapi_bridge.py");

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
        console.warn("[Instagram] Python stderr:", stderr.trim());
      }
      const raw = stdout.trim();
      if (!raw) {
        reject(
          new Error(
            `Instagram bridge produced no output (exit ${code}). stderr: ${stderr.slice(0, 300)}`
          )
        );
        return;
      }
      try {
        const result: BridgeResult = JSON.parse(raw);
        resolve(result);
      } catch {
        reject(
          new Error(`Instagram bridge returned non-JSON: ${raw.slice(0, 300)}`)
        );
      }
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn instagrapi_bridge.py: ${err.message}. ` +
            `Make sure scripts/venv exists with instagrapi installed.`
        )
      );
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loginInstagram(
  username: string,
  password: string,
  verificationCode?: string,
  partialSessionJson?: string
): Promise<{ sessionJson: string; username: string; userId: string }> {
  const result = await runBridge({
    action: "login",
    username,
    password,
    ...(verificationCode && { verification_code: verificationCode }),
    ...(partialSessionJson && { partial_session_json: partialSessionJson }),
  });

  if (!result.success) {
    // Attach partial session to error so caller can pass it back on retry
    const err: any = new Error(result.error || "Instagram login failed");
    err.code = result.code;
    err.partialSessionJson = result.partial_session_json;
    throw err;
  }

  // Store session in SocialAccount
  const accountLabel = result.username || "default";
  await db.socialAccount.upsert({
    where: { platform_label: { platform: "instagram", label: accountLabel } },
    create: {
      platform: "instagram",
      label: accountLabel,
      cookies: result.session_json!,
      username: result.username,
      status: "active",
      isDefault: true,
    },
    update: {
      cookies: result.session_json!,
      username: result.username,
      status: "active",
    },
  });

  // Initialize settings if not exists
  const settingsCount = await db.instagramSettings.count();
  if (settingsCount === 0) {
    await db.instagramSettings.create({
      data: { igUserId: result.user_id },
    });
  } else {
    await db.instagramSettings.updateMany({
      data: { igUserId: result.user_id },
    });
  }

  console.log(`[Instagram] Logged in as @${result.username} (${result.user_id})`);

  return {
    sessionJson: result.session_json!,
    username: result.username!,
    userId: result.user_id!,
  };
}

export async function checkInstagramSession(): Promise<{
  valid: boolean;
  username?: string;
  userId?: string;
}> {
  try {
    const sessionJson = await getInstagramSession();
    const result = await runBridge({ action: "check_session", session_json: sessionJson });

    if (!result.success || !result.valid) {
      await markExpired();
      return { valid: false };
    }

    return {
      valid: true,
      username: result.username,
      userId: result.user_id,
    };
  } catch {
    return { valid: false };
  }
}

export async function getInstagramFollowers(
  amount: number = 200
): Promise<BridgeResult["followers"]> {
  const sessionJson = await getInstagramSession();

  // Get the stored user_id from settings
  const settings = await db.instagramSettings.findFirst();
  if (!settings?.igUserId) {
    throw new Error("Instagram user ID not found. Please re-login.");
  }

  const result = await runBridge({
    action: "get_followers",
    session_json: sessionJson,
    user_id: settings.igUserId,
    amount,
  });

  if (!result.success) {
    const errMsg = result.error || "Failed to fetch followers";
    if (/session expired|login required/i.test(errMsg)) {
      await markExpired();
    }
    throw new Error(errMsg);
  }

  return result.followers ?? [];
}

export async function sendInstagramDM(
  userId: string,
  text: string
): Promise<{ threadId: string; messageId: string }> {
  const sessionJson = await getInstagramSession();

  const result = await runBridge({
    action: "send_dm",
    session_json: sessionJson,
    user_id: userId,
    text,
  });

  if (!result.success) {
    const errMsg = result.error || "Failed to send DM";
    if (/session expired|login required/i.test(errMsg)) {
      await markExpired();
    }
    throw new Error(errMsg);
  }

  return {
    threadId: result.thread_id || "",
    messageId: result.message_id || "",
  };
}

export async function getInstagramUserInfo(): Promise<{
  userId: string;
  username: string;
  fullName: string;
  followerCount: number;
  followingCount: number;
  profilePicUrl: string;
}> {
  const sessionJson = await getInstagramSession();

  const result = await runBridge({
    action: "get_user_info",
    session_json: sessionJson,
  });

  if (!result.success) {
    const errMsg = result.error || "Failed to get user info";
    if (/session expired|login required/i.test(errMsg)) {
      await markExpired();
    }
    throw new Error(errMsg);
  }

  return {
    userId: result.user_id!,
    username: result.username!,
    fullName: result.full_name || "",
    followerCount: result.follower_count || 0,
    followingCount: result.following_count || 0,
    profilePicUrl: result.profile_pic_url || "",
  };
}

// ---------------------------------------------------------------------------
// New: get user info by username (for prospects)
// ---------------------------------------------------------------------------

export async function getInstagramUserByUsername(
  username: string,
  accountId?: string
): Promise<IGUserInfo> {
  const sessionJson = await getInstagramSession(accountId);

  const result = await runBridge({
    action: "get_user_by_username",
    session_json: sessionJson,
    username,
  });

  if (!result.success) {
    const errMsg = result.error || "Failed to get user info";
    if (/session expired|login required/i.test(errMsg)) {
      await markExpired(accountId);
    }
    throw new Error(errMsg);
  }

  return {
    user_id: result.user_id!,
    username: result.username!,
    full_name: result.full_name || "",
    biography: result.biography || "",
    follower_count: result.follower_count || 0,
    following_count: result.following_count || 0,
    media_count: result.media_count || 0,
    is_private: result.is_private || false,
    is_business: result.is_business || false,
    profile_pic_url: result.profile_pic_url || "",
  };
}

// ---------------------------------------------------------------------------
// New: get DM inbox (for polling replies)
// ---------------------------------------------------------------------------

export async function getInstagramDMInbox(
  accountId?: string,
  amount: number = 20
): Promise<IGDMConversation[]> {
  const sessionJson = await getInstagramSession(accountId);

  const result = await runBridge({
    action: "get_dm_inbox",
    session_json: sessionJson,
    amount,
  });

  if (!result.success) {
    const errMsg = result.error || "Failed to fetch DM inbox";
    if (/session expired|login required/i.test(errMsg)) {
      await markExpired(accountId);
    }
    throw new Error(errMsg);
  }

  return result.conversations || [];
}

// ---------------------------------------------------------------------------
// New: search users (for finding prospects)
// ---------------------------------------------------------------------------

export async function searchInstagramUsers(
  query: string,
  accountId?: string,
  amount: number = 10
): Promise<IGUserInfo[]> {
  const sessionJson = await getInstagramSession(accountId);

  const result = await runBridge({
    action: "search_users",
    session_json: sessionJson,
    query,
    amount,
  });

  if (!result.success) {
    const errMsg = result.error || "Failed to search users";
    if (/session expired|login required/i.test(errMsg)) {
      await markExpired(accountId);
    }
    throw new Error(errMsg);
  }

  return result.users || [];
}

// ---------------------------------------------------------------------------
// New: send DM by username (resolves user_id automatically)
// ---------------------------------------------------------------------------

export async function sendInstagramDMByUsername(
  username: string,
  text: string,
  accountId?: string
): Promise<{ threadId: string; messageId: string; userId: string }> {
  // First resolve the username to a user_id
  const userInfo = await getInstagramUserByUsername(username, accountId);
  const dmResult = await sendInstagramDM(userInfo.user_id, text);

  return {
    ...dmResult,
    userId: userInfo.user_id,
  };
}
