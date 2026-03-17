import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTwitterDM, getDMInbox, searchTweets, getUserInfo } from "@/lib/twitter";
import { sendInstagramDMByUsername, getInstagramDMInbox, searchInstagramUsers, getInstagramUserByUsername } from "@/lib/instagram";
import { initiateOutreach, processInboundMessage } from "@/lib/sales-engine";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

// ── Platform-aware DM sender ─────────────────────────────────────────────

async function sendDM(
  platform: string,
  username: string,
  text: string,
  socialAccountId?: string
): Promise<{ dm_id: string }> {
  if (platform === "instagram") {
    const result = await sendInstagramDMByUsername(username, text, socialAccountId);
    return { dm_id: result.messageId || result.threadId };
  }
  // Default: Twitter
  return sendTwitterDM(username, text, socialAccountId);
}

// POST /api/sales/engine — main engine endpoint
// Modes: "outreach" | "find_prospects" | "ig_find_prospects" | "poll_dms" | "ig_poll_dms" | "process_replies" | "send_pending" | "auto_cycle"
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode: string = body.mode;

  // ─── Find Prospects via Twitter Search ───────────────────────────────
  if (mode === "find_prospects") {
    const query: string = body.query || "looking for AI tools";
    const maxResults: number = body.maxResults || 10;
    const accountId: string | undefined = body.accountId;

    try {
      const tweets = await searchTweets(query, maxResults, accountId);
      const prospects: Array<{
        username: string;
        displayName: string;
        bio: string;
        followers: number;
        tweetText: string;
        tweetUrl: string;
        alreadyExists: boolean;
      }> = [];

      for (const tweet of (tweets || [])) {
        if (!tweet.authorHandle) continue;

        const existing = await db.salesProspect.findUnique({
          where: {
            platform_username: {
              platform: "twitter",
              username: tweet.authorHandle,
            },
          },
        });

        let bio = "";
        let followers = 0;
        try {
          const info = await getUserInfo(tweet.authorHandle, accountId);
          bio = info.bio || "";
          followers = info.followers || 0;
        } catch {
          // best-effort
        }

        prospects.push({
          username: tweet.authorHandle,
          displayName: tweet.author,
          bio,
          followers,
          tweetText: tweet.text,
          tweetUrl: tweet.url,
          alreadyExists: !!existing,
        });
      }

      return NextResponse.json({ ok: true, prospects, count: prospects.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ─── Find Prospects via Instagram Search ────────────────────────────
  if (mode === "ig_find_prospects") {
    const query: string = body.query || "";
    const maxResults: number = body.maxResults || 10;
    const accountId: string | undefined = body.accountId;

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    try {
      const users = await searchInstagramUsers(query, accountId, maxResults);
      const prospects: Array<{
        username: string;
        displayName: string;
        bio: string;
        followers: number;
        userId: string;
        isPrivate: boolean;
        alreadyExists: boolean;
      }> = [];

      for (const user of users) {
        const existing = await db.salesProspect.findUnique({
          where: {
            platform_username: {
              platform: "instagram",
              username: user.username,
            },
          },
        });

        prospects.push({
          username: user.username,
          displayName: user.full_name,
          bio: user.biography || "",
          followers: user.follower_count || 0,
          userId: user.user_id,
          isPrivate: user.is_private || false,
          alreadyExists: !!existing,
        });
      }

      return NextResponse.json({ ok: true, prospects, count: prospects.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ─── Initiate Outreach to Specific Prospects ─────────────────────────
  if (mode === "outreach") {
    const platform: string = body.platform || "twitter";
    const targets: Array<{
      username: string;
      displayName?: string;
      bio?: string;
      followers?: number;
      source?: string;
      sourceDetails?: unknown;
    }> = body.targets || [];

    const accountId: string | undefined = body.accountId;

    if (targets.length === 0) {
      return NextResponse.json({ error: "No targets provided" }, { status: 400 });
    }

    const results: Array<{
      username: string;
      success: boolean;
      sessionId?: string;
      message?: string;
      error?: string;
    }> = [];

    for (const target of targets) {
      try {
        const result = await initiateOutreach({
          platform,
          username: target.username,
          displayName: target.displayName,
          bio: target.bio,
          followers: target.followers,
          source: target.source || "search",
          sourceDetails: target.sourceDetails,
          socialAccountId: accountId,
        });

        results.push({
          username: target.username,
          success: true,
          sessionId: result.sessionId,
          message: result.message,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ username: target.username, success: false, error: message });
      }
    }

    return NextResponse.json({ ok: true, results });
  }

  // ─── Send Pending Messages (platform-aware) ───────────────────────────
  if (mode === "send_pending") {
    const pendingMessages = await db.salesMessage.findMany({
      where: { status: "pending", role: "outbound" },
      include: {
        session: {
          include: { prospect: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: body.limit || 10,
    });

    const results: Array<{
      messageId: string;
      username: string;
      platform: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const msg of pendingMessages) {
      const prospect = msg.session.prospect;

      // Human-like delay between DMs
      if (results.length > 0) {
        await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));
      }

      try {
        const dmResult = await sendDM(
          prospect.platform,
          prospect.username,
          msg.content,
          prospect.socialAccountId || undefined
        );

        await db.salesMessage.update({
          where: { id: msg.id },
          data: {
            status: "sent",
            externalId: dmResult.dm_id,
            sentAt: new Date(),
          },
        });

        await db.salesProspect.update({
          where: { id: prospect.id },
          data: { status: "contacted", lastContactedAt: new Date() },
        });

        await db.salesSession.update({
          where: { id: msg.sessionId },
          data: { lastMessageAt: new Date() },
        });

        results.push({ messageId: msg.id, username: prospect.username, platform: prospect.platform, success: true });
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        await db.salesMessage.update({
          where: { id: msg.id },
          data: { status: "failed", error },
        });
        results.push({ messageId: msg.id, username: prospect.username, platform: prospect.platform, success: false, error });
      }
    }

    const sent = results.filter((r) => r.success).length;
    return NextResponse.json({ ok: true, sent, total: results.length, results });
  }

  // ─── Poll Twitter DM Inbox for Replies ────────────────────────────────
  if (mode === "poll_dms") {
    const accountId: string | undefined = body.accountId;

    try {
      const conversations = await getDMInbox(accountId);

      const activeSessions = await db.salesSession.findMany({
        where: { isActive: true, isPaused: false, prospect: { platform: "twitter" } },
        include: {
          prospect: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      const sessionByUsername = new Map<string, typeof activeSessions[0]>();
      for (const session of activeSessions) {
        sessionByUsername.set(session.prospect.username.toLowerCase(), session);
      }

      const newReplies: Array<{
        username: string;
        sessionId: string;
        messageText: string;
      }> = [];

      for (const conv of conversations) {
        for (const participant of conv.participants) {
          const session = sessionByUsername.get(participant.username.toLowerCase());
          if (!session) continue;

          for (const msg of conv.messages) {
            if (msg.sender_id === participant.id && msg.text) {
              const existing = msg.id ? await db.salesMessage.findFirst({
                where: { externalId: msg.id },
              }) : null;

              if (!existing && msg.text.trim()) {
                newReplies.push({
                  username: participant.username,
                  sessionId: session.id,
                  messageText: msg.text,
                });
              }
            }
          }
        }
      }

      return NextResponse.json({
        ok: true,
        conversationsPolled: conversations.length,
        newReplies: newReplies.length,
        replies: newReplies,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ─── Poll Instagram DM Inbox for Replies ──────────────────────────────
  if (mode === "ig_poll_dms") {
    const accountId: string | undefined = body.accountId;

    try {
      const conversations = await getInstagramDMInbox(accountId);

      const activeSessions = await db.salesSession.findMany({
        where: { isActive: true, isPaused: false, prospect: { platform: "instagram" } },
        include: {
          prospect: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      const sessionByUsername = new Map<string, typeof activeSessions[0]>();
      for (const session of activeSessions) {
        sessionByUsername.set(session.prospect.username.toLowerCase(), session);
      }

      const newReplies: Array<{
        username: string;
        sessionId: string;
        messageText: string;
      }> = [];

      for (const conv of conversations) {
        for (const participant of conv.participants) {
          const session = sessionByUsername.get(participant.username.toLowerCase());
          if (!session) continue;

          for (const msg of conv.messages) {
            if (msg.sender_id === participant.user_id && msg.text) {
              const existing = msg.id ? await db.salesMessage.findFirst({
                where: { externalId: msg.id },
              }) : null;

              if (!existing && msg.text.trim()) {
                newReplies.push({
                  username: participant.username,
                  sessionId: session.id,
                  messageText: msg.text,
                });
              }
            }
          }
        }
      }

      return NextResponse.json({
        ok: true,
        conversationsPolled: conversations.length,
        newReplies: newReplies.length,
        replies: newReplies,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ─── Process Inbound Replies (generate AI responses) ─────────────────
  if (mode === "process_replies") {
    const replies: Array<{ sessionId: string; text: string; externalId?: string }> =
      body.replies || [];

    if (replies.length === 0) {
      return NextResponse.json({ error: "No replies to process" }, { status: 400 });
    }

    const results: Array<{
      sessionId: string;
      success: boolean;
      reply?: string;
      stage?: string;
      error?: string;
    }> = [];

    for (const reply of replies) {
      try {
        const result = await processInboundMessage(
          reply.sessionId,
          reply.text,
          reply.externalId
        );

        results.push({
          sessionId: reply.sessionId,
          success: true,
          reply: result.reply,
          stage: result.stage,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ sessionId: reply.sessionId, success: false, error: message });
      }
    }

    return NextResponse.json({ ok: true, results });
  }

  // ─── Full Auto-Pipeline: send → poll (both platforms) → process ─────
  if (mode === "auto_cycle") {
    const accountId: string | undefined = body.accountId;
    const igAccountId: string | undefined = body.igAccountId;
    const log: string[] = [];

    try {
      // Step 1: Send any pending messages (platform-aware)
      const pending = await db.salesMessage.findMany({
        where: { status: "pending", role: "outbound" },
        include: { session: { include: { prospect: true } } },
        take: 5,
      });

      let sent = 0;
      for (const msg of pending) {
        try {
          if (sent > 0) await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));

          const dmResult = await sendDM(
            msg.session.prospect.platform,
            msg.session.prospect.username,
            msg.content,
            msg.session.prospect.socialAccountId || undefined
          );

          await db.salesMessage.update({
            where: { id: msg.id },
            data: { status: "sent", externalId: dmResult.dm_id, sentAt: new Date() },
          });

          await db.salesProspect.update({
            where: { id: msg.session.prospectId },
            data: { status: "contacted", lastContactedAt: new Date() },
          });

          await db.salesSession.update({
            where: { id: msg.sessionId },
            data: { lastMessageAt: new Date() },
          });

          sent++;
          log.push(`[${msg.session.prospect.platform}] Sent DM to @${msg.session.prospect.username}`);
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          await db.salesMessage.update({
            where: { id: msg.id },
            data: { status: "failed", error },
          });
          log.push(`[${msg.session.prospect.platform}] Failed DM to @${msg.session.prospect.username}: ${error}`);
        }
      }

      // Step 2: Poll Twitter for new replies
      let newRepliesCount = 0;

      try {
        const twitterConversations = await getDMInbox(accountId);
        const twitterSessions = await db.salesSession.findMany({
          where: { isActive: true, isPaused: false, prospect: { platform: "twitter" } },
          include: { prospect: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        const twitterSessionByUsername = new Map<string, typeof twitterSessions[0]>();
        for (const s of twitterSessions) {
          twitterSessionByUsername.set(s.prospect.username.toLowerCase(), s);
        }

        for (const conv of twitterConversations) {
          for (const participant of conv.participants) {
            const session = twitterSessionByUsername.get(participant.username.toLowerCase());
            if (!session) continue;

            for (const msg of conv.messages) {
              if (msg.sender_id === participant.id && msg.text) {
                const existing = msg.id ? await db.salesMessage.findFirst({
                  where: { externalId: msg.id },
                }) : null;

                if (!existing && msg.text.trim()) {
                  try {
                    const result = await processInboundMessage(session.id, msg.text, msg.id);
                    newRepliesCount++;
                    log.push(`[twitter] Reply from @${participant.username} → stage: ${result.stage}`);
                  } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : String(err);
                    log.push(`[twitter] Failed processing reply from @${participant.username}: ${error}`);
                  }
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        log.push(`[twitter] DM polling failed: ${error}`);
      }

      // Step 3: Poll Instagram for new replies
      try {
        const igConversations = await getInstagramDMInbox(igAccountId);
        const igSessions = await db.salesSession.findMany({
          where: { isActive: true, isPaused: false, prospect: { platform: "instagram" } },
          include: { prospect: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        const igSessionByUsername = new Map<string, typeof igSessions[0]>();
        for (const s of igSessions) {
          igSessionByUsername.set(s.prospect.username.toLowerCase(), s);
        }

        for (const conv of igConversations) {
          for (const participant of conv.participants) {
            const session = igSessionByUsername.get(participant.username.toLowerCase());
            if (!session) continue;

            for (const msg of conv.messages) {
              if (msg.sender_id === participant.user_id && msg.text) {
                const existing = msg.id ? await db.salesMessage.findFirst({
                  where: { externalId: msg.id },
                }) : null;

                if (!existing && msg.text.trim()) {
                  try {
                    const result = await processInboundMessage(session.id, msg.text, msg.id);
                    newRepliesCount++;
                    log.push(`[instagram] Reply from @${participant.username} → stage: ${result.stage}`);
                  } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : String(err);
                    log.push(`[instagram] Failed processing reply from @${participant.username}: ${error}`);
                  }
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        log.push(`[instagram] DM polling failed: ${error}`);
      }

      return NextResponse.json({
        ok: true,
        sent,
        newReplies: newRepliesCount,
        log,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
}
