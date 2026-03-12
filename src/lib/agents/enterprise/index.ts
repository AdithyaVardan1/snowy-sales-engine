import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { searchTavilyNews } from "../../tavily";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Enterprise Outreach Agent
 *
 * Runs daily at 8am to:
 * 1. Research companies investing in AI/automation
 * 2. Generate personalized enterprise outreach messages
 * 3. Track outreach pipeline
 * 4. Auto-add high-value prospects to partner pipeline
 * 5. Generate daily enterprise report
 */
export class EnterpriseOutreachRunner implements AgentRunner {
  slug = "enterprise";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    // ── 1. Search for enterprise AI adoption news ──
    const searchQueries = [
      "enterprise company adopting AI agents 2026",
      "Fortune 500 AI automation investment",
      "large company deploying AI tools infrastructure",
    ];

    const articles: Array<{ title: string; url: string; content: string }> = [];
    for (const query of searchQueries) {
      try {
        const results = await searchTavilyNews(query, 3);
        articles.push(...results.map((r) => ({ title: r.title, url: r.url, content: r.content })));
      } catch (e) {
        errors.push(`Search "${query}": ${e}`);
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniqueArticles = articles.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    if (uniqueArticles.length > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "enterprise_news",
          subject: "ai_adoption",
          data: JSON.stringify({ count: uniqueArticles.length, articles: uniqueArticles.map((a) => ({ title: a.title, url: a.url })) }),
        },
      });
      observationsCreated++;
    }

    // ── 2. Identify enterprise prospects via AI ──
    let prospects: Array<{
      company: string;
      industry: string;
      reason: string;
      painPoint: string;
      outreach: string;
    }> = [];

    if (uniqueArticles.length > 0) {
      try {
        const context = uniqueArticles
          .map((a) => `${a.title}: ${a.content.slice(0, 300)}`)
          .join("\n\n");

        const raw = await generate(
          `You are an enterprise sales researcher for Snowy AI — a cloud-hosted OpenClaw platform for deploying AI agents.
- Starter: $12.5/mo, Pro: $39.5/mo, Enterprise: $79.5/mo (custom SLA, dedicated infra)
- Website: agent.snowballlabs.org

From these news articles, identify 3-5 enterprise companies that could benefit from Snowy AI's Enterprise plan.

For each, provide:
- company: Company name
- industry: Industry sector
- reason: Why they'd be interested (1 sentence)
- painPoint: Their likely pain point with AI deployment
- outreach: Personalized enterprise outreach message (3-4 sentences, executive-level tone)

Return JSON: { "prospects": [...] }
Return ONLY valid JSON, no markdown fences.`,
          context,
          1024
        );

        const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        prospects = parsed.prospects || [];
      } catch (e) {
        errors.push(`Prospect identification: ${e}`);
      }
    }

    if (prospects.length > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "enterprise_prospects",
          subject: "new_targets",
          data: JSON.stringify({ count: prospects.length, prospects }),
          importance: "high",
        },
      });
      observationsCreated++;

      // ── 3. Auto-add top prospects to partner pipeline ──
      const existingPartners = await db.partner.findMany({ select: { name: true } });
      const existingNames = new Set(existingPartners.map((p) => p.name.toLowerCase()));

      let added = 0;
      for (const prospect of prospects.slice(0, 3)) {
        if (existingNames.has(prospect.company.toLowerCase())) continue;

        try {
          const newPartner = await db.partner.create({
            data: {
              name: prospect.company,
              category: "api_provider",
              platform: "other",
              status: "identified",
              dealDetails: `Industry: ${prospect.industry}`,
            },
          });
          await db.partnerNote.create({
            data: {
              partnerId: newPartner.id,
              content: `[Auto-added by Enterprise Agent]\nPain point: ${prospect.painPoint}\nOutreach draft: ${prospect.outreach}`,
              author: "Enterprise Agent",
            },
          });
          added++;
        } catch (e) {
          // Might fail on unique constraint etc
          errors.push(`Add partner ${prospect.company}: ${e}`);
        }
      }

      if (added > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "pipeline_update",
            subject: "partners_added",
            data: JSON.stringify({ added, companies: prospects.slice(0, added).map((p) => p.company) }),
            importance: "high",
          },
        });
        observationsCreated++;
      }
    }

    // ── 4. Track enterprise pipeline metrics ──
    const enterprisePartners = await db.partner.findMany({
      where: { category: "api_provider" },
      select: { name: true, status: true, updatedAt: true },
    });

    const stages: Record<string, number> = {};
    enterprisePartners.forEach((p) => { stages[p.status] = (stages[p.status] || 0) + 1; });

    await db.agentObservation.create({
      data: {
        agentId: agent.id,
        category: "enterprise_pipeline",
        subject: "status",
        data: JSON.stringify({ total: enterprisePartners.length, stages }),
      },
    });
    observationsCreated++;

    // ── 5. Daily enterprise report ──
    const lastReportDate = await getMemory<string>(agent.id, "last_report_date");
    const today = new Date().toISOString().split("T")[0];

    if (lastReportDate !== today) {
      try {
        const report = await generate(
          `You are an enterprise sales director. Write a daily enterprise outreach report in markdown. Include: new prospects identified, pipeline status, companies added, and recommended outreach actions for today. Keep under 350 words. Be specific with company names.`,
          `News articles found: ${uniqueArticles.length}\nNew prospects: ${prospects.length}\nEnterprise pipeline: ${JSON.stringify(stages)}\nTotal enterprise partners: ${enterprisePartners.length}\nTop prospects: ${JSON.stringify(prospects.slice(0, 3))}`,
          512
        );

        await db.agentReport.create({
          data: {
            agentId: agent.id,
            type: "daily_summary",
            title: `Enterprise Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            content: report,
            data: JSON.stringify({ prospects: prospects.length, pipelineTotal: enterprisePartners.length, stages }),
          },
        });
        reportsCreated++;
        await setMemory(agent.id, "last_report_date", today);
      } catch (e) {
        errors.push(`Report: ${e}`);
      }
    }

    await setMemory(agent.id, "total_prospects_found", (await getMemory<number>(agent.id, "total_prospects_found") ?? 0) + prospects.length);

    // Cleanup
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Found ${uniqueArticles.length} articles, identified ${prospects.length} enterprise prospects. Pipeline: ${enterprisePartners.length} total. ${errors.length} errors.`,
    };
  }
}
