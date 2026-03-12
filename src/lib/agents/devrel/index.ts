import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { searchTavilyNews } from "../../tavily";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Developer Relations Agent
 *
 * Runs every 8 hours to:
 * 1. Monitor hackathon announcements and developer events
 * 2. Find developer conversations about AI agents/tools
 * 3. Generate technical content ideas
 * 4. Track developer community engagement
 * 5. Generate weekly devrel report
 */
export class DevRelRunner implements AgentRunner {
  slug = "devrel";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    // ── 1. Search for hackathons and dev events ──
    let hackathons: Array<{ title: string; url: string; content: string }> = [];
    try {
      const results = await searchTavilyNews("AI hackathon developer event 2026", 3);
      hackathons = results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
    } catch (e) {
      errors.push(`Hackathon search: ${e}`);
    }

    if (hackathons.length > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "hackathons",
          subject: "events_found",
          data: JSON.stringify({ count: hackathons.length, events: hackathons.map((h) => ({ title: h.title, url: h.url })) }),
          importance: "high",
        },
      });
      observationsCreated++;
    }

    // ── 2. Find developer discussions about AI agents ──
    let devDiscussions: Array<{ title: string; url: string; content: string }> = [];
    try {
      const results = await searchTavilyNews("developers building AI agents tools discussion", 5);
      devDiscussions = results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
    } catch (e) {
      errors.push(`Dev discussions: ${e}`);
    }

    // ── 3. Check community posts for developer-related content ──
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const devPosts = await db.communityPost.findMany({
      where: {
        fetchedAt: { gte: twoDaysAgo },
        OR: [
          { body: { contains: "API" } },
          { body: { contains: "SDK" } },
          { body: { contains: "developer" } },
          { body: { contains: "integration" } },
          { body: { contains: "deploy" } },
          { title: { contains: "build" } },
        ],
      },
      take: 20,
      select: { title: true, body: true, author: true, source: true, url: true },
    });

    if (devPosts.length > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "dev_conversations",
          subject: "technical_posts",
          data: JSON.stringify({
            count: devPosts.length,
            posts: devPosts.map((p) => ({ title: p.title, author: p.author, source: p.source })),
          }),
        },
      });
      observationsCreated++;
    }

    // ── 4. Generate technical content ideas ──
    const allContext = [
      ...hackathons.map((h) => `[Event] ${h.title}: ${h.content.slice(0, 200)}`),
      ...devDiscussions.map((d) => `[Discussion] ${d.title}: ${d.content.slice(0, 200)}`),
      ...devPosts.map((p) => `[Community] ${p.title}: ${(p.body || "").slice(0, 150)}`),
    ].join("\n");

    let contentIdeas: Array<{ title: string; type: string; angle: string }> = [];
    if (allContext.length > 0) {
      try {
        const raw = await generate(
          `You are a DevRel content strategist for Snowy AI (cloud-hosted OpenClaw, agent hosting platform — agent.snowballlabs.org).
Analyze developer discussions and events to suggest 3 technical content pieces.

For each, provide:
- title: Blog/tutorial title
- type: "tutorial" | "guide" | "comparison" | "case_study"
- angle: What makes it unique/timely (1 sentence)

Return JSON: { "ideas": [...] }
Return ONLY valid JSON, no markdown fences.`,
          allContext,
          512
        );

        const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        contentIdeas = parsed.ideas || [];
      } catch (e) {
        errors.push(`Content ideas: ${e}`);
      }

      if (contentIdeas.length > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "content_ideas",
            subject: "technical_content",
            data: JSON.stringify({ ideas: contentIdeas }),
            importance: "normal",
          },
        });
        observationsCreated++;
      }
    }

    // ── 5. Track GitHub activity ──
    try {
      const githubPosts = await db.communityPost.count({
        where: { source: "github", fetchedAt: { gte: twoDaysAgo } },
      });
      const totalGithubPosts = await db.communityPost.count({ where: { source: "github" } });

      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "github_activity",
          subject: "metrics",
          data: JSON.stringify({ last48h: githubPosts, total: totalGithubPosts }),
        },
      });
      observationsCreated++;
    } catch (e) {
      errors.push(`GitHub metrics: ${e}`);
    }

    // ── 6. Weekly DevRel report ──
    const lastReportDate = await getMemory<string>(agent.id, "last_report_date");
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();

    // Generate report on Mondays or if never generated
    if (!lastReportDate || (dayOfWeek === 1 && lastReportDate !== today)) {
      try {
        const weekObs = await db.agentObservation.findMany({
          where: { agentId: agent.id, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          take: 50,
        });

        const obsText = weekObs.map((o) => `[${o.category}] ${o.data.slice(0, 200)}`).join("\n");

        const report = await generate(
          `You are a DevRel manager. Write a weekly developer relations report in markdown. Include: hackathon opportunities, developer engagement summary, content ideas pipeline, and recommended actions for the week. Keep under 400 words.`,
          `Weekly observations:\n${obsText}`,
          1024
        );

        await db.agentReport.create({
          data: {
            agentId: agent.id,
            type: "daily_summary",
            title: `DevRel Weekly — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            content: report,
            data: JSON.stringify({ hackathons: hackathons.length, devPosts: devPosts.length, contentIdeas: contentIdeas.length }),
          },
        });
        reportsCreated++;
        await setMemory(agent.id, "last_report_date", today);
      } catch (e) {
        errors.push(`Report: ${e}`);
      }
    }

    // Cleanup
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Found ${hackathons.length} hackathons, ${devPosts.length} dev posts, generated ${contentIdeas.length} content ideas. ${errors.length} errors.`,
    };
  }
}
