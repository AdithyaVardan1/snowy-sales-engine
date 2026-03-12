import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendInstagramDM } from "@/lib/instagram";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min)) * 1000;
}

export async function POST() {
  try {
    // 1. Check settings
    const settings = await db.instagramSettings.findFirst();
    if (!settings || !settings.autoDmEnabled) {
      return NextResponse.json({
        skipped: true,
        reason: "Auto-DM is disabled",
      });
    }

    // 2. Count DMs sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dmsSentToday = await db.instagramDM.count({
      where: {
        sentAt: { gte: todayStart },
        status: "sent",
      },
    });

    const remainingQuota = settings.maxDmsPerDay - dmsSentToday;
    if (remainingQuota <= 0) {
      return NextResponse.json({
        skipped: true,
        reason: `Daily DM limit reached (${settings.maxDmsPerDay})`,
        dmsSentToday,
      });
    }

    // 3. Get default template
    const template = await db.instagramTemplate.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!template) {
      return NextResponse.json({
        skipped: true,
        reason: "No default active template found. Create one and set it as default.",
      });
    }

    // 4. Get new followers who haven't been DM'd
    const pendingFollowers = await db.instagramFollower.findMany({
      where: { isNew: true, dmSent: false },
      orderBy: { firstSeenAt: "asc" },
      take: remainingQuota,
    });

    if (pendingFollowers.length === 0) {
      return NextResponse.json({
        dmsSent: 0,
        reason: "No new followers to DM",
        remainingQuota,
      });
    }

    // 5. Send DMs with delays
    let dmsSent = 0;
    const errors: string[] = [];

    for (const follower of pendingFollowers) {
      try {
        const messageContent = template.content.replace(
          /\{\{username\}\}/g,
          follower.username
        );

        const result = await sendInstagramDM(follower.igUserId, messageContent);

        await db.instagramDM.create({
          data: {
            igUserId: follower.igUserId,
            username: follower.username,
            templateId: template.id,
            content: messageContent,
            status: "sent",
            threadId: result.threadId,
            messageId: result.messageId,
          },
        });

        await db.instagramFollower.update({
          where: { igUserId: follower.igUserId },
          data: { dmSent: true, dmSentAt: new Date(), isNew: false },
        });

        dmsSent++;
        console.log(`[Instagram Auto-DM] Sent to @${follower.username}`);

        // Random delay between DMs (skip after last one)
        if (follower !== pendingFollowers[pendingFollowers.length - 1]) {
          const delayMs = randomDelay(
            settings.minDelaySeconds,
            settings.maxDelaySeconds
          );
          console.log(`[Instagram Auto-DM] Waiting ${delayMs / 1000}s...`);
          await sleep(delayMs);
        }
      } catch (error: any) {
        const errMsg = error.message || "Unknown error";
        errors.push(`@${follower.username}: ${errMsg}`);
        console.error(`[Instagram Auto-DM] Failed for @${follower.username}:`, errMsg);

        await db.instagramDM.create({
          data: {
            igUserId: follower.igUserId,
            username: follower.username,
            templateId: template.id,
            content: template.content.replace(/\{\{username\}\}/g, follower.username),
            status: "failed",
            error: errMsg,
          },
        });

        // If it's a session/auth error, stop the entire batch
        if (/session expired|login required|rate limit/i.test(errMsg)) {
          errors.push("Stopping batch due to auth/rate-limit error");
          break;
        }
      }
    }

    if (dmsSent > 0) {
      await db.activityLog.create({
        data: {
          type: "instagram_auto_dm",
          channel: "instagram",
          details: JSON.stringify({ dmsSent, errors: errors.length }),
        },
      });
    }

    return NextResponse.json({
      dmsSent,
      errors,
      remainingQuota: remainingQuota - dmsSent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Auto-DM failed" },
      { status: 500 }
    );
  }
}
