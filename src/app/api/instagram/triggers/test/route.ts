import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendMessageFromPayload,
  checkRateLimit,
} from "@/lib/instagram-api";

/**
 * POST /api/instagram/triggers/test
 * Simulates a webhook comment event to test a trigger's DM flow.
 * Body: { triggerId, igUserId, username, commentText? }
 */
export async function POST(request: NextRequest) {
  try {
    const { triggerId, igUserId, username, commentText } = await request.json();

    if (!triggerId || !igUserId || !username) {
      return NextResponse.json(
        { error: "triggerId, igUserId, and username are required" },
        { status: 400 }
      );
    }

    // Find the trigger
    const trigger = await db.instagramCommentTrigger.findUnique({
      where: { id: triggerId },
    });

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    // Check rate limit
    const rateOk = await checkRateLimit();
    if (!rateOk) {
      return NextResponse.json(
        { error: "Rate limit reached (200 DMs/hour)" },
        { status: 429 }
      );
    }

    // Parse the message payload
    let messagePayload: any;
    try {
      messagePayload = JSON.parse(trigger.messagePayload);
    } catch {
      return NextResponse.json(
        { error: "Invalid message payload JSON in trigger" },
        { status: 500 }
      );
    }

    // Send the DM
    const result = await sendMessageFromPayload(
      igUserId,
      messagePayload,
      username
    );

    // Log it
    await db.instagramCommentLog.create({
      data: {
        triggerId: trigger.id,
        igCommentId: `test_${Date.now()}`,
        igUserId,
        username,
        commentText: commentText || `[Test] ${trigger.keyword}`,
        matched: true,
        dmSent: true,
        dmStatus: "sent",
      },
    });

    // Update trigger stats
    await db.instagramCommentTrigger.update({
      where: { id: trigger.id },
      data: { dmsSent: { increment: 1 } },
    });

    return NextResponse.json({
      ok: true,
      message: `Test DM sent to @${username}`,
      result,
    });
  } catch (error: any) {
    console.error("[TestTrigger] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send test DM" },
      { status: 500 }
    );
  }
}
