import * as cron from "node-cron";
import { db } from "./db";

const activeTasks = new Map<string, ReturnType<typeof cron.schedule>>();

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

async function runFetchCommunity() {
  console.log("[Scheduler] Fetching community posts...");
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    await fetch(`${baseUrl}/api/community/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ source: "all" }),
    });
    console.log("[Scheduler] Community fetch complete");
    return { success: true };
  } catch (error) {
    console.error("[Scheduler] Community fetch failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runPostScheduledSocial() {
  console.log("[Scheduler] Checking for scheduled social posts...");
  try {
    const now = new Date();
    const duePosts = await db.socialPost.findMany({
      where: {
        status: "scheduled",
        scheduledFor: { lte: now },
      },
    });

    for (const post of duePosts) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        await fetch(`${baseUrl}/api/social/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        });
        console.log(`[Scheduler] Published social post ${post.id} to ${post.platform}`);
      } catch (e) {
        console.error(`[Scheduler] Failed to publish post ${post.id}:`, e);
      }
    }

    console.log(`[Scheduler] Processed ${duePosts.length} scheduled posts`);
    return { success: true, count: duePosts.length };
  } catch (error) {
    console.error("[Scheduler] Social post check failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runScheduledBlogGeneration() {
  console.log("[Scheduler] Checking for scheduled blog generation...");
  try {
    const now = new Date();
    const duePosts = await db.blogPost.findMany({
      where: {
        status: "scheduled",
        scheduledFor: { lte: now },
      },
    });

    for (const post of duePosts) {
      await db.blogPost.update({
        where: { id: post.id },
        data: { status: "published", publishedAt: now },
      });
      console.log(`[Scheduler] Published blog post: ${post.title}`);
    }

    return { success: true, count: duePosts.length };
  } catch (error) {
    console.error("[Scheduler] Blog generation check failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runAutoPostTech(config?: string) {
  console.log("[Scheduler] Running auto-post tech news...");
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    let body: Record<string, unknown> = {};
    if (config) {
      try { body = JSON.parse(config); } catch {}
    }

    const res = await fetch(`${baseUrl}/api/social/auto-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[Scheduler] Auto-post complete: ${data.posted || 0} posts published`);
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (error) {
    console.error("[Scheduler] Auto-post tech failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runPollInstagramFollowers() {
  console.log("[Scheduler] Polling Instagram followers...");
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/instagram/followers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[Scheduler] Instagram poll complete: ${data.newFollowers || 0} new followers`);
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (error) {
    console.error("[Scheduler] Instagram follower poll failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runInstagramAutoDM() {
  console.log("[Scheduler] Running Instagram auto-DM...");
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/instagram/auto-dm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[Scheduler] Instagram auto-DM complete: ${data.dmsSent || 0} DMs sent`);
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (error) {
    console.error("[Scheduler] Instagram auto-DM failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runAgentJob(config?: string) {
  console.log("[Scheduler] Running agent job...");
  try {
    const parsed = config ? JSON.parse(config) : {};
    const agentSlug = parsed.agentSlug;
    if (!agentSlug) return { success: false, error: "No agentSlug in config" };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/agents/${agentSlug}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[Scheduler] Agent ${agentSlug} run complete:`, data);
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (error) {
    console.error("[Scheduler] Agent job failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runTrendPost(config?: string) {
  console.log("[Scheduler] Running trend-based content posting...");
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    let body: Record<string, unknown> = { mode: "post" };
    if (config) {
      try { Object.assign(body, JSON.parse(config)); } catch {}
    }

    const res = await fetch(`${baseUrl}/api/social/trend-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[Scheduler] Trend post complete: ${data.posted || 0} posts published`);
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (error) {
    console.error("[Scheduler] Trend post failed:", error);
    return { success: false, error: String(error) };
  }
}

async function runRedditAutoReply(config?: string) {
  console.log("[Scheduler] Running Reddit auto-reply...");
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    let body: Record<string, unknown> = {};
    if (config) {
      try { body = JSON.parse(config); } catch {}
    }

    const res = await fetch(`${baseUrl}/api/community/reddit-auto-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[Scheduler] Reddit auto-reply complete: ${data.replied || 0} replies posted`);
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(data) };
  } catch (error) {
    console.error("[Scheduler] Reddit auto-reply failed:", error);
    return { success: false, error: String(error) };
  }
}

const JOB_RUNNERS: Record<string, (config?: string) => Promise<{ success: boolean; error?: string }>> = {
  fetch_community: runFetchCommunity,
  post_social: runPostScheduledSocial,
  generate_blog: runScheduledBlogGeneration,
  auto_post_tech: runAutoPostTech,
  poll_instagram_followers: runPollInstagramFollowers,
  instagram_auto_dm: runInstagramAutoDM,
  agent_run: runAgentJob,
  trend_post: runTrendPost,
  reddit_auto_reply: runRedditAutoReply,
};

export async function startScheduler() {
  // Stop all existing tasks
  activeTasks.forEach((task, id) => {
    task.stop();
    activeTasks.delete(id);
  });

  const jobs = await db.cronJob.findMany({ where: { enabled: true } });

  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      console.warn(`[Scheduler] Invalid cron expression for job ${job.name}: ${job.schedule}`);
      continue;
    }

    const runner = JOB_RUNNERS[job.type];
    if (!runner) {
      console.warn(`[Scheduler] Unknown job type: ${job.type}`);
      continue;
    }

    const task = cron.schedule(job.schedule, async () => {
      console.log(`[Scheduler] Running job: ${job.name}`);
      const result = await runner(job.config || undefined);

      await db.cronJob.update({
        where: { id: job.id },
        data: {
          lastRunAt: new Date(),
          lastResult: result.success ? "success" : "error",
          lastError: result.error || null,
        },
      });
    });

    activeTasks.set(job.id, task);
    console.log(`[Scheduler] Registered job: ${job.name} (${job.schedule})`);
  }

  console.log(`[Scheduler] Started with ${activeTasks.size} active jobs`);
}

export async function stopScheduler() {
  activeTasks.forEach((task) => task.stop());
  activeTasks.clear();
}

export function getActiveJobCount(): number {
  return activeTasks.size;
}
