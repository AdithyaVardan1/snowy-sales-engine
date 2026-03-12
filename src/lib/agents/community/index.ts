import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Community Monitor Agent
 *
 * Runs every 30 minutes to:
 * 1. Fetch new community posts (Twitter mentions, Reddit, GitHub)
 * 2. Auto-generate AI draft responses for new posts
 * 3. Identify potential ambassadors (frequent positive engagers)
 * 4. Track community sentiment and engagement trends
 * 5. Generate daily community briefing
 */
export class CommunityMonitorRunner implements AgentRunner {
  slug = "community";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    // ── 1. Fetch new community posts via internal API ──
    let fetchResult = { fetched: 0, new: 0, total: 0 };
    try {
      fetchResult = await this.fetchCommunityPosts();
      if (fetchResult.new > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "community_fetch",
            subject: "all_sources",
            data: JSON.stringify(fetchResult),
            importance: fetchResult.new > 10 ? "high" : "normal",
          },
        });
        observationsCreated++;
      }
    } catch (e) {
      errors.push(`Fetch: ${e}`);
    }

    // ── 2. Auto-draft responses for new posts ──
    let draftCount = 0;
    try {
      draftCount = await this.autoDraftResponses(agent.id);
      if (draftCount > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "auto_drafts",
            subject: "all_sources",
            data: JSON.stringify({ draftsGenerated: draftCount }),
          },
        });
        observationsCreated++;
      }
    } catch (e) {
      errors.push(`Drafts: ${e}`);
    }

    // ── 3. Monitor Twitter mentions specifically ──
    let mentionData: { mentions: number; questions: number; positive: number } | null = null;
    try {
      mentionData = await this.monitorMentions(agent.id);
      if (mentionData && mentionData.mentions > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "twitter_mentions",
            subject: "mentions",
            data: JSON.stringify(mentionData),
            importance: mentionData.questions > 3 ? "high" : "normal",
          },
        });
        observationsCreated++;
      }
    } catch (e) {
      errors.push(`Mentions: ${e}`);
    }

    // ── 4. Identify ambassadors ──
    try {
      const ambassadorResult = await this.spotAmbassadors(agent.id);
      if (ambassadorResult.newAmbassadors > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "ambassadors",
            subject: "identification",
            data: JSON.stringify(ambassadorResult),
            importance: ambassadorResult.newAmbassadors > 0 ? "high" : "normal",
          },
        });
        observationsCreated++;
      }
    } catch (e) {
      errors.push(`Ambassadors: ${e}`);
    }

    // ── 5. Track engagement metrics ──
    try {
      const metrics = await this.trackEngagement(agent.id);
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "engagement_metrics",
          subject: "overview",
          data: JSON.stringify(metrics),
        },
      });
      observationsCreated++;
    } catch (e) {
      errors.push(`Metrics: ${e}`);
    }

    // ── 6. Generate daily briefing (once per day) ──
    const lastBriefingDate = await getMemory<string>(agent.id, "last_briefing_date");
    const today = new Date().toISOString().split("T")[0];

    if (lastBriefingDate !== today) {
      try {
        const briefing = await this.generateDailyBriefing(agent.id);
        if (briefing) {
          await db.agentReport.create({
            data: {
              agentId: agent.id,
              type: "daily_summary",
              title: `Community Briefing — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              content: briefing,
              data: JSON.stringify({
                newPosts: fetchResult?.new ?? 0,
                draftsGenerated: draftCount,
                mentions: mentionData?.mentions ?? 0,
              }),
            },
          });
          reportsCreated++;
          await setMemory(agent.id, "last_briefing_date", today);
        }
      } catch (e) {
        errors.push(`Briefing: ${e}`);
      }
    }

    // ── 7. Cleanup old observations (>60 days) ──
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    await db.agentObservation.deleteMany({
      where: { agentId: agent.id, createdAt: { lt: cutoff } },
    });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Fetched ${fetchResult?.new ?? 0} new posts, drafted ${draftCount} responses, ${mentionData?.mentions ?? 0} mentions. ${errors.length} errors.`,
    };
  }

  /**
   * Fetch community posts from all sources via internal API
   */
  private async fetchCommunityPosts() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const secret = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

    const res = await fetch(`${baseUrl}/api/community/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ source: "all" }),
    });

    if (!res.ok) throw new Error(`Community fetch failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Auto-generate AI draft responses for new posts that don't have drafts yet
   */
  private async autoDraftResponses(agentId: string): Promise<number> {
    const newPosts = await db.communityPost.findMany({
      where: { status: "new", draftResponse: null },
      orderBy: { fetchedAt: "desc" },
      take: 5, // Limit to 5 per run to control AI costs
    });

    let draftCount = 0;
    for (const post of newPosts) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const secret = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

        const res = await fetch(`${baseUrl}/api/community/draft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": secret,
          },
          body: JSON.stringify({ postId: post.id }),
        });

        if (res.ok) draftCount++;
      } catch (e) {
        console.warn(`[CommunityMonitor] Draft failed for post ${post.id}:`, e);
      }
    }

    return draftCount;
  }

  /**
   * Monitor Twitter for @mentions and classify them
   */
  private async monitorMentions(agentId: string): Promise<{ mentions: number; questions: number; positive: number }> {
    // Get Twitter handle from settings or use default
    const settings = await db.appSetting.findUnique({ where: { key: "TWITTER_HANDLE" } });
    const handle = settings?.value || "SnowyAI";

    // Get keywords to monitor
    const keywordSetting = await db.appSetting.findUnique({ where: { key: "KEYWORDS" } });
    const keywords = keywordSetting?.value
      ? keywordSetting.value.split(",").map((k: string) => k.trim()).filter(Boolean)
      : ["snowy ai", "snowball labs"];

    // Count recent posts by type
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const recentPosts = await db.communityPost.findMany({
      where: {
        source: "twitter",
        fetchedAt: { gte: oneDayAgo },
      },
    });

    let questions = 0;
    let positive = 0;

    for (const post of recentPosts) {
      const text = (post.title + " " + post.body).toLowerCase();
      if (text.includes("?") || text.includes("how") || text.includes("help") || text.includes("issue")) {
        questions++;
      }
      if (text.includes("love") || text.includes("great") || text.includes("amazing") || text.includes("awesome") || text.includes("thanks")) {
        positive++;
      }
    }

    // Store mention count in memory for trend tracking
    const prevMentions = await getMemory<number>(agentId, "last_mention_count") ?? 0;
    await setMemory(agentId, "last_mention_count", recentPosts.length);
    await setMemory(agentId, "mention_trend", recentPosts.length > prevMentions ? "up" : recentPosts.length < prevMentions ? "down" : "stable");

    return { mentions: recentPosts.length, questions, positive };
  }

  /**
   * Identify potential ambassadors — users who engage frequently and positively
   */
  private async spotAmbassadors(agentId: string): Promise<{ newAmbassadors: number; ambassadors: Array<{ author: string; postCount: number; sources: string[] }> }> {
    // Look at all posts from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const posts = await db.communityPost.findMany({
      where: { fetchedAt: { gte: thirtyDaysAgo } },
      select: { author: true, source: true },
    });

    // Count posts per author
    const authorMap = new Map<string, { count: number; sources: Set<string> }>();
    for (const post of posts) {
      if (!post.author || post.author === "unknown") continue;
      const existing = authorMap.get(post.author) || { count: 0, sources: new Set<string>() };
      existing.count++;
      existing.sources.add(post.source);
      authorMap.set(post.author, existing);
    }

    // Ambassadors = users with 3+ posts or active on multiple platforms
    const ambassadors: Array<{ author: string; postCount: number; sources: string[] }> = [];
    authorMap.forEach((data, author) => {
      if (data.count >= 3 || data.sources.size >= 2) {
        ambassadors.push({
          author,
          postCount: data.count,
          sources: Array.from(data.sources),
        });
      }
    });

    // Sort by post count
    ambassadors.sort((a, b) => b.postCount - a.postCount);

    // Check against known ambassadors in memory
    const knownAmbassadors = await getMemory<string[]>(agentId, "known_ambassadors") ?? [];
    const newOnes = ambassadors.filter((a) => !knownAmbassadors.includes(a.author));

    // Update memory
    await setMemory(agentId, "known_ambassadors", ambassadors.map((a) => a.author));

    return { newAmbassadors: newOnes.length, ambassadors: ambassadors.slice(0, 10) };
  }

  /**
   * Track overall community engagement metrics
   */
  private async trackEngagement(agentId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, last24h, last7d, responded, newPosts] = await Promise.all([
      db.communityPost.count(),
      db.communityPost.count({ where: { fetchedAt: { gte: oneDayAgo } } }),
      db.communityPost.count({ where: { fetchedAt: { gte: sevenDaysAgo } } }),
      db.communityPost.count({ where: { status: "responded" } }),
      db.communityPost.count({ where: { status: "new" } }),
    ]);

    // Source breakdown for last 7 days
    const recentPosts = await db.communityPost.findMany({
      where: { fetchedAt: { gte: sevenDaysAgo } },
      select: { source: true },
    });

    const sourceBreakdown: Record<string, number> = {};
    for (const p of recentPosts) {
      sourceBreakdown[p.source] = (sourceBreakdown[p.source] || 0) + 1;
    }

    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

    // Store for trend comparison
    const prevMetrics = await getMemory<{ last24h: number; last7d: number }>(agentId, "prev_engagement");
    await setMemory(agentId, "prev_engagement", { last24h, last7d });

    return {
      total,
      last24h,
      last7d,
      responded,
      newPosts,
      responseRate,
      sourceBreakdown,
      trend24h: prevMetrics ? (last24h > prevMetrics.last24h ? "up" : last24h < prevMetrics.last24h ? "down" : "stable") : "new",
    };
  }

  /**
   * Generate a daily community briefing using AI
   */
  private async generateDailyBriefing(agentId: string): Promise<string | null> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayObs = await db.agentObservation.findMany({
      where: { agentId, createdAt: { gte: todayStart } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    if (todayObs.length === 0) return null;

    const obsText = todayObs
      .map((o) => `[${o.category}] ${o.subject}: ${o.data.slice(0, 300)}`)
      .join("\n");

    // Get some recent unanswered posts for context
    const unanswered = await db.communityPost.findMany({
      where: { status: "new" },
      orderBy: { fetchedAt: "desc" },
      take: 10,
      select: { title: true, source: true, author: true, fetchedAt: true },
    });

    const unansweredText = unanswered.length > 0
      ? "\n\nUnanswered posts needing attention:\n" + unanswered.map((p) => `- [${p.source}] "${p.title}" by ${p.author}`).join("\n")
      : "";

    const systemPrompt = `You are a community manager assistant for Snowy AI by Snowball Labs, an AI-powered sales engine.
Analyze today's community activity and write a concise daily briefing in markdown.
Include:
- Summary of new community activity (posts, mentions, engagement)
- Any questions that need urgent attention
- Potential ambassador candidates
- Sentiment overview
- Recommended actions for the community team
Keep it under 400 words. Use bullet points and sections.`;

    const userMessage = `Today's community observations:\n\n${obsText}${unansweredText}`;

    return await generate(systemPrompt, userMessage, 1024);
  }
}
