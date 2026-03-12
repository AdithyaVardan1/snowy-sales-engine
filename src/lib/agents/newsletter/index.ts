import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Newsletter Compiler Agent
 *
 * Runs weekly (Monday 9am) to:
 * 1. Collect all agent reports from the past week
 * 2. Gather top community posts, social highlights, and news
 * 3. Compile into a comprehensive weekly newsletter
 * 4. Store as a blog post draft for review
 */
export class NewsletterCompilerRunner implements AgentRunner {
  slug = "newsletter";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── 1. Collect all agent reports from the week ──
    const weeklyReports = await db.agentReport.findMany({
      where: { createdAt: { gte: oneWeekAgo } },
      include: { agent: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    const reportSummary = weeklyReports
      .map((r) => `[${r.agent.name}] ${r.title}:\n${r.content.slice(0, 300)}`)
      .join("\n\n");

    await db.agentObservation.create({
      data: {
        agentId: agent.id,
        category: "weekly_collection",
        subject: "agent_reports",
        data: JSON.stringify({ reportCount: weeklyReports.length, agents: Array.from(new Set(weeklyReports.map((r) => r.agent.name))) }),
      },
    });
    observationsCreated++;

    // ── 2. Gather top community highlights ──
    const topPosts = await db.communityPost.findMany({
      where: { fetchedAt: { gte: oneWeekAgo } },
      orderBy: { fetchedAt: "desc" },
      take: 20,
      select: { title: true, body: true, source: true, author: true, url: true },
    });

    const communityHighlights = topPosts
      .map((p) => `[${p.source}] ${p.title || "(no title)"} by ${p.author}`)
      .join("\n");

    // ── 3. Gather social post highlights ──
    const topSocial = await db.socialPost.findMany({
      where: { status: "posted", postedAt: { gte: oneWeekAgo } },
      orderBy: { postedAt: "desc" },
      take: 10,
      select: { platform: true, content: true, postedAt: true },
    });

    const socialHighlights = topSocial
      .map((p) => `[${p.platform}] ${p.content.slice(0, 150)}`)
      .join("\n");

    // ── 4. Gather blog posts published this week ──
    const weeklyBlogs = await db.blogPost.findMany({
      where: { status: "published", publishedAt: { gte: oneWeekAgo } },
      select: { title: true, slug: true, metaDescription: true },
    });

    // ── 5. Get key observations with high importance ──
    const importantObs = await db.agentObservation.findMany({
      where: { importance: "high", createdAt: { gte: oneWeekAgo } },
      include: { agent: { select: { name: true } } },
      take: 15,
    });

    const highlightObs = importantObs
      .map((o) => `[${o.agent.name}] ${o.category}: ${o.data.slice(0, 200)}`)
      .join("\n");

    // ── 6. Generate newsletter ──
    let newsletter = "";
    try {
      const input = `AGENT REPORTS THIS WEEK (${weeklyReports.length} total):
${reportSummary || "No reports"}

COMMUNITY HIGHLIGHTS (${topPosts.length} posts):
${communityHighlights || "No posts"}

SOCIAL MEDIA (${topSocial.length} posts):
${socialHighlights || "No social posts"}

BLOG POSTS (${weeklyBlogs.length}):
${weeklyBlogs.map((b) => `"${b.title}" — ${b.metaDescription || ""}`).join("\n") || "No blogs"}

KEY ALERTS:
${highlightObs || "None"}`;

      newsletter = await generate(
        `You are a newsletter editor for Snowy AI (cloud-hosted OpenClaw platform by Snowball Labs — agent.snowballlabs.org).

Compile a weekly newsletter in markdown. The newsletter should be informative, engaging, and position Snowy AI as a thought leader.

Structure:
# Snowy AI Weekly — [Date Range]

## This Week in AI
Top 3 industry developments (from agent reports and news)

## Community Spotlight
Highlight interesting community discussions and contributors

## From Our Blog
Featured blog posts (if any)

## Product Updates
Any relevant Snowy AI updates (synthesize from agent observations)

## What We're Watching
3 trends to watch next week

## Numbers That Matter
Key metrics snapshot

---
*Powered by Snowy AI — Deploy AI agents without infrastructure headaches.*
*agent.snowballlabs.org*

Keep it under 800 words. Make it something people actually want to read.`,
        input,
        2048
      );
    } catch (e) {
      errors.push(`Newsletter generation: ${e}`);
    }

    if (newsletter) {
      // Save as agent report
      await db.agentReport.create({
        data: {
          agentId: agent.id,
          type: "weekly_comparative",
          title: `Weekly Newsletter — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          content: newsletter,
          data: JSON.stringify({
            agentReports: weeklyReports.length,
            communityPosts: topPosts.length,
            socialPosts: topSocial.length,
            blogPosts: weeklyBlogs.length,
            importantObservations: importantObs.length,
          }),
        },
      });
      reportsCreated++;

      // ── 7. Also save as a draft blog post ──
      try {
        const weekStart = new Date(oneWeekAgo);
        const weekEnd = new Date();
        const dateRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        const slug = `weekly-newsletter-${weekEnd.toISOString().split("T")[0]}`;

        // Check if already exists
        const existing = await db.blogPost.findUnique({ where: { slug } });
        if (!existing) {
          await db.blogPost.create({
            data: {
              title: `Snowy AI Weekly — ${dateRange}`,
              slug,
              content: newsletter,
              metaDescription: `Weekly roundup: ${weeklyReports.length} agent reports, ${topPosts.length} community posts, ${topSocial.length} social updates.`,
              status: "draft",
            },
          });

          await db.agentObservation.create({
            data: {
              agentId: agent.id,
              category: "newsletter_published",
              subject: "blog_draft",
              data: JSON.stringify({ slug, title: `Snowy AI Weekly — ${dateRange}` }),
              importance: "high",
            },
          });
          observationsCreated++;
        }
      } catch (e) {
        errors.push(`Blog draft: ${e}`);
      }
    }

    await setMemory(agent.id, "last_newsletter_date", new Date().toISOString().split("T")[0]);
    await setMemory(agent.id, "total_newsletters", ((await getMemory<number>(agent.id, "total_newsletters")) ?? 0) + 1);

    // Cleanup
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Compiled weekly newsletter from ${weeklyReports.length} reports, ${topPosts.length} community posts, ${topSocial.length} social posts. ${errors.length} errors.`,
    };
  }
}
