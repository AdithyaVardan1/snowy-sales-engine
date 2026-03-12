import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { searchTavilyNews } from "../../tavily";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Business Development Agent
 *
 * Runs every 12 hours to:
 * 1. Research prospects from community posts and news
 * 2. Identify potential partners/customers
 * 3. Generate personalized outreach messages
 * 4. Track BD pipeline progress
 * 5. Generate daily BD report
 */
export class BusinessDevRunner implements AgentRunner {
  slug = "business_dev";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    // ── 1. Research prospects from recent community activity ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const communityPosts = await db.communityPost.findMany({
      where: { fetchedAt: { gte: sevenDaysAgo } },
      orderBy: { fetchedAt: "desc" },
      take: 50,
      select: { title: true, body: true, author: true, source: true, url: true },
    });

    // ── 2. Search for companies using AI agents ──
    let newsProspects: Array<{ title: string; url: string; content: string }> = [];
    try {
      const results = await searchTavilyNews("companies adopting AI agents automation", 5);
      newsProspects = results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
    } catch (e) {
      errors.push(`Tavily: ${e}`);
    }

    // ── 3. Use AI to identify prospects and generate outreach ──
    const communityContext = communityPosts
      .map((p) => `[${p.source}] ${p.author}: ${p.title || ""} — ${(p.body || "").slice(0, 150)}`)
      .join("\n");

    const newsContext = newsProspects
      .map((a) => `${a.title}: ${a.content.slice(0, 200)}`)
      .join("\n");

    let prospects: Array<{ name: string; type: string; reason: string; outreach: string }> = [];

    try {
      const raw = await generate(
        `You are a BD analyst for Snowy AI (cloud-hosted OpenClaw platform by Snowball Labs — agent.snowballlabs.org).
Analyze community posts and news to identify potential prospects (companies, developers, or teams that could benefit from Snowy AI).

For each prospect, provide:
- name: Company/person name
- type: "company" | "developer" | "team"
- reason: Why they're a good prospect (1 sentence)
- outreach: Personalized outreach message (2-3 sentences, professional, not salesy)

Return JSON: { "prospects": [...] }
Return ONLY valid JSON, no markdown fences. Return 3-5 prospects max.`,
        `COMMUNITY POSTS:\n${communityContext || "No recent posts"}\n\nNEWS:\n${newsContext || "No news"}`,
        1024
      );

      const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      prospects = parsed.prospects || [];
    } catch (e) {
      errors.push(`Prospect analysis: ${e}`);
    }

    if (prospects.length > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "prospect_research",
          subject: "new_prospects",
          data: JSON.stringify({ count: prospects.length, prospects }),
          importance: prospects.length >= 3 ? "high" : "normal",
        },
      });
      observationsCreated++;
    }

    // ── 4. Track pipeline stats ──
    const partners = await db.partner.findMany({ select: { status: true } });
    const pipeline: Record<string, number> = {};
    partners.forEach((p) => { pipeline[p.status] = (pipeline[p.status] || 0) + 1; });

    await db.agentObservation.create({
      data: {
        agentId: agent.id,
        category: "pipeline_status",
        subject: "overview",
        data: JSON.stringify({ totalPartners: partners.length, stages: pipeline }),
      },
    });
    observationsCreated++;

    // ── 5. Check for stale deals ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stalePartners = await db.partner.findMany({
      where: { updatedAt: { lt: thirtyDaysAgo }, status: { notIn: ["closed_won", "closed_lost"] } },
      select: { name: true, status: true, updatedAt: true },
    });

    if (stalePartners.length > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "pipeline_alert",
          subject: "stale_deals",
          data: JSON.stringify({ count: stalePartners.length, partners: stalePartners }),
          importance: "high",
        },
      });
      observationsCreated++;
    }

    // ── 6. Daily BD report ──
    const lastReportDate = await getMemory<string>(agent.id, "last_report_date");
    const today = new Date().toISOString().split("T")[0];

    if (lastReportDate !== today) {
      try {
        const reportContent = await generate(
          `You are a BD operations analyst. Write a concise daily BD report in markdown for Snowy AI. Include: prospect pipeline summary, new prospects found, stale deals alert, and recommended actions. Keep under 350 words.`,
          `Pipeline: ${JSON.stringify(pipeline)}\nNew prospects: ${prospects.length}\nStale deals: ${stalePartners.length}\nProspect details: ${JSON.stringify(prospects.slice(0, 3))}\nStale deals: ${JSON.stringify(stalePartners.slice(0, 5))}`,
          512
        );

        await db.agentReport.create({
          data: {
            agentId: agent.id,
            type: "daily_summary",
            title: `BD Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            content: reportContent,
            data: JSON.stringify({ prospects: prospects.length, pipeline, staleDealCount: stalePartners.length }),
          },
        });
        reportsCreated++;
        await setMemory(agent.id, "last_report_date", today);
      } catch (e) {
        errors.push(`Report: ${e}`);
      }
    }

    await setMemory(agent.id, "last_prospect_count", prospects.length);

    // Cleanup
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Found ${prospects.length} prospects, pipeline has ${partners.length} partners, ${stalePartners.length} stale. ${errors.length} errors.`,
    };
  }
}
