import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Analytics & Briefing Agent
 *
 * Runs daily at 9am to:
 * 1. Collect metrics from all sources (community, social, partners, blog)
 * 2. Aggregate agent observations from last 24h
 * 3. Generate a comprehensive morning briefing
 * 4. Track week-over-week trends
 */
export class AnalyticsRunner implements AgentRunner {
  slug = "analytics";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── 1. Community metrics ──
    let communityMetrics;
    try {
      const [totalPosts, newPosts24h, newPosts7d, respondedPosts] = await Promise.all([
        db.communityPost.count(),
        db.communityPost.count({ where: { fetchedAt: { gte: oneDayAgo } } }),
        db.communityPost.count({ where: { fetchedAt: { gte: sevenDaysAgo } } }),
        db.communityPost.count({ where: { status: "responded" } }),
      ]);

      // Source breakdown
      const recentPosts = await db.communityPost.findMany({
        where: { fetchedAt: { gte: sevenDaysAgo } },
        select: { source: true },
      });
      const sources: Record<string, number> = {};
      recentPosts.forEach((p) => { sources[p.source] = (sources[p.source] || 0) + 1; });

      communityMetrics = { totalPosts, newPosts24h, newPosts7d, respondedPosts, responseRate: totalPosts > 0 ? Math.round((respondedPosts / totalPosts) * 100) : 0, sources };

      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "metrics_community",
          subject: "daily_snapshot",
          data: JSON.stringify(communityMetrics),
        },
      });
      observationsCreated++;
    } catch (e) {
      errors.push(`Community metrics: ${e}`);
      communityMetrics = null;
    }

    // ── 2. Social media metrics ──
    let socialMetrics;
    try {
      const [totalSocialPosts, posted24h, posted7d] = await Promise.all([
        db.socialPost.count({ where: { status: "posted" } }),
        db.socialPost.count({ where: { status: "posted", postedAt: { gte: oneDayAgo } } }),
        db.socialPost.count({ where: { status: "posted", postedAt: { gte: sevenDaysAgo } } }),
      ]);

      const platformBreakdown = await db.socialPost.findMany({
        where: { status: "posted", postedAt: { gte: sevenDaysAgo } },
        select: { platform: true },
      });
      const platforms: Record<string, number> = {};
      platformBreakdown.forEach((p) => { platforms[p.platform] = (platforms[p.platform] || 0) + 1; });

      socialMetrics = { totalSocialPosts, posted24h, posted7d, platforms };

      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "metrics_social",
          subject: "daily_snapshot",
          data: JSON.stringify(socialMetrics),
        },
      });
      observationsCreated++;
    } catch (e) {
      errors.push(`Social metrics: ${e}`);
      socialMetrics = null;
    }

    // ── 3. Partner pipeline metrics ──
    let pipelineMetrics;
    try {
      const partners = await db.partner.findMany({ select: { status: true, updatedAt: true } });
      const stages: Record<string, number> = {};
      partners.forEach((p) => { stages[p.status] = (stages[p.status] || 0) + 1; });

      const activeDeals = partners.filter((p) => !["closed_won", "closed_lost"].includes(p.status)).length;

      pipelineMetrics = { totalPartners: partners.length, activeDeals, stages };

      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "metrics_pipeline",
          subject: "daily_snapshot",
          data: JSON.stringify(pipelineMetrics),
        },
      });
      observationsCreated++;
    } catch (e) {
      errors.push(`Pipeline metrics: ${e}`);
      pipelineMetrics = null;
    }

    // ── 4. Blog metrics ──
    let blogMetrics;
    try {
      const [totalBlogs, publishedBlogs] = await Promise.all([
        db.blogPost.count(),
        db.blogPost.count({ where: { status: "published" } }),
      ]);

      const recentBlogs = await db.blogPost.findMany({
        where: { publishedAt: { gte: sevenDaysAgo } },
        select: { title: true, publishedAt: true },
      });

      blogMetrics = { totalBlogs, publishedBlogs, recentlyPublished: recentBlogs.length };

      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "metrics_blog",
          subject: "daily_snapshot",
          data: JSON.stringify(blogMetrics),
        },
      });
      observationsCreated++;
    } catch (e) {
      errors.push(`Blog metrics: ${e}`);
      blogMetrics = null;
    }

    // ── 5. Collect agent reports from last 24h ──
    let agentSummaries: string[] = [];
    try {
      const recentReports = await db.agentReport.findMany({
        where: { createdAt: { gte: oneDayAgo } },
        select: { title: true, content: true },
        take: 10,
      });
      agentSummaries = recentReports.map((r) => `**${r.title}**\n${r.content.slice(0, 300)}`);
    } catch (e) {
      errors.push(`Agent reports: ${e}`);
    }

    // ── 6. Track week-over-week trends ──
    const prevMetrics = await getMemory<{
      community24h: number;
      social24h: number;
      activeDeals: number;
    }>(agent.id, "prev_day_metrics");

    const todaySnapshot = {
      community24h: communityMetrics?.newPosts24h ?? 0,
      social24h: socialMetrics?.posted24h ?? 0,
      activeDeals: pipelineMetrics?.activeDeals ?? 0,
    };
    await setMemory(agent.id, "prev_day_metrics", todaySnapshot);

    // ── 7. Generate morning briefing ──
    try {
      const trendText = prevMetrics
        ? `Trends vs yesterday: Community ${todaySnapshot.community24h > prevMetrics.community24h ? "UP" : todaySnapshot.community24h < prevMetrics.community24h ? "DOWN" : "FLAT"}, Social ${todaySnapshot.social24h > prevMetrics.social24h ? "UP" : todaySnapshot.social24h < prevMetrics.social24h ? "DOWN" : "FLAT"}, Pipeline ${todaySnapshot.activeDeals > prevMetrics.activeDeals ? "UP" : todaySnapshot.activeDeals < prevMetrics.activeDeals ? "DOWN" : "FLAT"}`
        : "First run — no trend data yet.";

      const briefingInput = `
COMMUNITY: ${JSON.stringify(communityMetrics || {})}
SOCIAL: ${JSON.stringify(socialMetrics || {})}
PIPELINE: ${JSON.stringify(pipelineMetrics || {})}
BLOG: ${JSON.stringify(blogMetrics || {})}
TRENDS: ${trendText}
AGENT REPORTS (last 24h): ${agentSummaries.length > 0 ? agentSummaries.join("\n\n") : "None"}
ERRORS: ${errors.length > 0 ? errors.join("; ") : "None"}`;

      const briefing = await generate(
        `You are a GTM operations analyst for Snowy AI. Write a comprehensive daily morning briefing in markdown.

Structure:
## Key Numbers
Quick metrics snapshot (community, social, pipeline, blog)

## Highlights
Top 3 things that happened in the last 24h

## Trends
Week-over-week comparisons

## Action Items
Top 3 recommended actions for today

## Agent Activity
Summary of what other agents did

Keep it concise, actionable, and under 500 words. Use bullet points.`,
        briefingInput,
        1024
      );

      await db.agentReport.create({
        data: {
          agentId: agent.id,
          type: "daily_summary",
          title: `Morning Briefing — ${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
          content: briefing,
          data: JSON.stringify({ communityMetrics, socialMetrics, pipelineMetrics, blogMetrics }),
        },
      });
      reportsCreated++;
    } catch (e) {
      errors.push(`Briefing: ${e}`);
    }

    // Cleanup
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Morning briefing generated. Community: ${communityMetrics?.newPosts24h ?? "?"} posts, Social: ${socialMetrics?.posted24h ?? "?"} posts, Pipeline: ${pipelineMetrics?.activeDeals ?? "?"} active deals. ${errors.length} errors.`,
    };
  }
}
