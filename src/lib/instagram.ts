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
  action: "login" | "check_session" | "get_followers" | "send_dm" | "get_user_info";
  username?: string;
  password?: string;
  session_json?: string;
  user_id?: string;
  text?: string;
  amount?: number;
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
  error?: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function getInstagramSession(): Promise<string> {
  const account = await db.socialAccount.findUnique({
    where: { platform: "instagram" },
  });

  if (!account || account.status === "expired") {
    throw new Error(
      "Instagram account not connected. Log in from the Instagram dashboard."
    );
  }

  return account.cookies; // session_json stored directly
}

async function markExpired() {
  await db.socialAccount
    .update({
      where: { platform: "instagram" },
      data: { status: "expired" },
    })
    .catch(() => {});
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
  password: string
): Promise<{ sessionJson: string; username: string; userId: string }> {
  const result = await runBridge({ action: "login", username, password });

  if (!result.success) {
    throw new Error(result.error || "Instagram login failed");
  }

  // Store session in SocialAccount
  await db.socialAccount.upsert({
    where: { platform: "instagram" },
    create: {
      platform: "instagram",
      cookies: result.session_json!,
      username: result.username,
      status: "active",
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
