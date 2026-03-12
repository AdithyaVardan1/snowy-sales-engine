import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendMessageFromPayload,
  checkRateLimit,
  checkUserCooldown,
} from "@/lib/instagram-api";

// GET — Meta webhook verification
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Missing parameters", { status: 400 });
  }

  const oauthToken = await db.instagramOAuthToken.findFirst({
    where: { isActive: true },
  });

  if (!oauthToken || token !== oauthToken.webhookVerifyToken) {
    return new Response("Forbidden", { status: 403 });
  }

  // Return challenge as plain text (Meta requirement)
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// POST — Incoming webhook events (comments, messages)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Must return 200 quickly — Meta retries if no response within 20s
  if (body.object !== "instagram") {
    return NextResponse.json({ received: true });
  }

  // Process asynchronously to avoid timeout
  processWebhookEntries(body.entry || []).catch(console.error);

  return NextResponse.json({ received: true });
}

async function processWebhookEntries(entries: WebhookEntry[]) {
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field === "comments") {
        await processComment(change.value);
      }
    }
  }
}

async function processComment(value: CommentValue) {
  const { from, text, id: commentId } = value;
  const mediaId = value.media?.id || null;

  // 1. Dedup — skip if already processed
  const existing = await db.instagramCommentLog.findUnique({
    where: { igCommentId: commentId },
  });
  if (existing) return;

  // 2. Find matching active triggers
  const triggers = await db.instagramCommentTrigger.findMany({
    where: { isActive: true },
  });

  let matched: (typeof triggers)[0] | null = null;
  for (const trigger of triggers) {
    // Check post filter
    if (trigger.postFilter && trigger.postFilter !== mediaId) continue;

    const keyword = trigger.keyword.toLowerCase();
    const comment = text.toLowerCase().trim();

    if (trigger.matchType === "exact" && comment === keyword) {
      matched = trigger;
      break;
    }
    if (trigger.matchType === "contains" && comment.includes(keyword)) {
      matched = trigger;
      break;
    }
    if (trigger.matchType === "starts_with" && comment.startsWith(keyword)) {
      matched = trigger;
      break;
    }
  }

  // 3. Log the comment
  const logEntry = await db.instagramCommentLog.create({
    data: {
      triggerId: matched?.id || null,
      igCommentId: commentId,
      igUserId: from.id,
      username: from.username,
      commentText: text,
      postId: mediaId,
      matched: !!matched,
    },
  });

  if (!matched) return;

  // 4. Rate limit check
  const rateCheck = await checkRateLimit();
  if (!rateCheck.allowed) {
    await db.instagramCommentLog.update({
      where: { id: logEntry.id },
      data: { dmStatus: "rate_limited" },
    });
    return;
  }

  // 5. User cooldown (1 DM per user per 24h)
  const onCooldown = await checkUserCooldown(from.id);
  if (onCooldown) {
    await db.instagramCommentLog.update({
      where: { id: logEntry.id },
      data: { dmStatus: "already_sent" },
    });
    return;
  }

  // 6. Send DM via official API
  try {
    await sendMessageFromPayload(from.id, matched.messagePayload, from.username);

    await db.instagramCommentLog.update({
      where: { id: logEntry.id },
      data: { dmSent: true, dmStatus: "sent", dmSentAt: new Date() },
    });

    await db.instagramCommentTrigger.update({
      where: { id: matched.id },
      data: { dmsSent: { increment: 1 } },
    });
  } catch (error: any) {
    await db.instagramCommentLog.update({
      where: { id: logEntry.id },
      data: { dmStatus: "failed", dmError: error.message },
    });
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface WebhookEntry {
  id: string;
  time: number;
  changes: WebhookChange[];
}

interface WebhookChange {
  field: string;
  value: CommentValue;
}

interface CommentValue {
  from: { username: string; id: string };
  text: string;
  id: string;
  media?: { id: string };
}
