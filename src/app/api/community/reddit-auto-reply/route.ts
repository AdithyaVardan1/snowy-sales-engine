import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDraftResponse } from "@/lib/anthropic";
import { replyToRedditPost } from "@/lib/reddit-post";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";
const DEFAULT_MAX_REPLIES = 10;

/**
 * POST /api/community/reddit-auto-reply
 * Automated Reddit commenting: picks unreplied Reddit posts,
 * generates AI replies, and posts them. Max 15/day by default.
 *
 * Body (optional): { maxReplies?: number, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  // Auth check — only internal scheduler or manual trigger
  const secret = request.headers.get("x-internal-secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const maxReplies: number = body.maxReplies || DEFAULT_MAX_REPLIES;
  const dryRun: boolean = body.dryRun || false;

  // Count how many Reddit replies we've already done today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const repliedToday = await db.communityPost.count({
    where: {
      source: "reddit",
      status: "responded",
      respondedAt: { gte: todayStart },
    },
  });

  const remaining = Math.max(0, maxReplies - repliedToday);
  if (remaining === 0) {
    return NextResponse.json({
      ok: true,
      message: `Daily limit reached (${maxReplies} replies). Already replied to ${repliedToday} posts today.`,
      replied: 0,
      repliedToday,
    });
  }

  // Get unreplied Reddit posts (status = "new" or "draft_ready")
  const unreplied = await db.communityPost.findMany({
    where: {
      source: "reddit",
      status: { in: ["new", "draft_ready"] },
    },
    orderBy: { fetchedAt: "desc" },
    take: remaining,
  });

  if (unreplied.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No unreplied Reddit posts found",
      replied: 0,
      repliedToday,
    });
  }

  const results: Array<{
    postId: string;
    title: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const post of unreplied) {
    try {
      // Extract thing ID from URL
      const match = post.url.match(/\/comments\/([a-z0-9]+)\//i);
      if (!match) {
        results.push({ postId: post.id, title: post.title, success: false, error: "Could not extract post ID from URL" });
        continue;
      }
      const thingId = `t3_${match[1]}`;

      // Generate AI reply
      const draft = await generateDraftResponse({
        title: post.title,
        body: post.body,
        source: post.source,
        url: post.url,
      });

      if (!draft || draft.startsWith("[No AI provider")) {
        results.push({ postId: post.id, title: post.title, success: false, error: "AI provider not configured" });
        continue;
      }

      if (dryRun) {
        // Save draft but don't post
        await db.communityPost.update({
          where: { id: post.id },
          data: { draftResponse: draft, status: "draft_ready" },
        });
        results.push({ postId: post.id, title: post.title, success: true, error: "dry_run" });
        continue;
      }

      // Post to Reddit
      const replyResult = await replyToRedditPost(thingId, draft);

      if (!replyResult.success) {
        // Save draft even if posting failed
        await db.communityPost.update({
          where: { id: post.id },
          data: { draftResponse: draft, status: "draft_ready" },
        });
        results.push({ postId: post.id, title: post.title, success: false, error: replyResult.error });

        // If rate limited, stop trying more
        if (replyResult.error?.toLowerCase().includes("rate")) {
          console.log("[RedditAutoReply] Rate limited, stopping batch");
          break;
        }
        continue;
      }

      // Mark as responded
      await db.communityPost.update({
        where: { id: post.id },
        data: {
          draftResponse: draft,
          finalResponse: draft,
          status: "responded",
          respondedBy: "auto_reddit_reply",
          respondedAt: new Date(),
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          type: "community_response",
          channel: "reddit",
          author: "auto_reddit_reply",
          details: JSON.stringify({
            postId: post.id,
            thingId,
            commentId: replyResult.commentId,
            subreddit: post.subreddit,
            title: post.title,
          }),
        },
      });

      results.push({ postId: post.id, title: post.title, success: true });

      // Spread replies across ~6 hours: 20-40 min gaps between each reply
      // 10 replies × ~30 min avg = ~5 hours, looks like natural human browsing
      if (unreplied.indexOf(post) < unreplied.length - 1) {
        const minDelay = 20 * 60 * 1000; // 20 minutes
        const maxDelay = 40 * 60 * 1000; // 40 minutes
        const delayMs = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
        console.log(`[RedditAutoReply] Waiting ${Math.round(delayMs / 60000)} minutes before next reply...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      results.push({ postId: post.id, title: post.title, success: false, error: msg });
    }
  }

  const succeeded = results.filter((r) => r.success && r.error !== "dry_run").length;

  return NextResponse.json({
    ok: true,
    replied: succeeded,
    attempted: results.length,
    repliedToday: repliedToday + succeeded,
    dailyLimit: maxReplies,
    dryRun,
    results,
  });
}
