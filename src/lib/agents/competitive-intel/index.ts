import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { AgentRunner, AgentRunResult, CompetitorDef } from "../types";
import { getMemory, setMemory } from "../memory";
import { COMPETITORS } from "./competitors";
import { fetchTokenDataBatch } from "./coingecko";
import { fetchTVL, fetchFees } from "./defillama";
import { fetchTwitterActivity } from "./twitter";
import { fetchDappRadarData } from "./dappradar";
import { fetchDuneData } from "./dune";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class CompetitiveIntelRunner implements AgentRunner {
  slug = "competitive_intel";

  async execute(agent: Agent): Promise<AgentRunResult> {
    const competitors = this.getCompetitors(agent);
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    // ── 1. Batch fetch token data (one CoinGecko call for all) ──
    const coingeckoIds = competitors
      .filter((c) => c.coingeckoId)
      .map((c) => c.coingeckoId!);

    let tokenBatch: Record<string, { price: number; marketCap: number; priceChange24hPct: number; volume24h: number }> = {};
    try {
      tokenBatch = await fetchTokenDataBatch(coingeckoIds);
    } catch (e) {
      errors.push(`CoinGecko batch: ${e}`);
      console.error("[CompetitiveIntel] CoinGecko batch failed:", e);
    }

    // ── 2. Process competitors in batches of 4 ──
    for (let i = 0; i < competitors.length; i += 4) {
      const batch = competitors.slice(i, i + 4);

      const results = await Promise.allSettled(
        batch.map((c) => this.processCompetitor(agent.id, c, tokenBatch))
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          observationsCreated += r.value;
        } else {
          errors.push(String(r.reason));
        }
      }

      // Small delay between batches to respect rate limits
      if (i + 4 < competitors.length) {
        await delay(2000);
      }
    }

    // ── 3. Generate daily summary ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayObs = await db.agentObservation.findMany({
      where: {
        agentId: agent.id,
        createdAt: { gte: todayStart },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    if (todayObs.length > 0) {
      try {
        const summary = await this.generateDailySummary(todayObs);
        await db.agentReport.create({
          data: {
            agentId: agent.id,
            type: "daily_summary",
            title: `Competitive Intel — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
            content: summary,
            data: JSON.stringify({
              observationCount: todayObs.length,
              competitors: Array.from(new Set(todayObs.map((o) => o.subject))),
              errors: errors.length,
            }),
          },
        });
        reportsCreated++;
      } catch (e) {
        console.error("[CompetitiveIntel] Daily summary generation failed:", e);
      }
    }

    // ── 4. Weekly comparative report (every ~28 runs at 6h = 7 days) ──
    const runCount = agent.runCount + 1;
    if (runCount > 0 && runCount % 28 === 0) {
      try {
        const weekReport = await this.generateWeeklyReport(agent.id);
        if (weekReport) reportsCreated++;
      } catch (e) {
        console.error("[CompetitiveIntel] Weekly report generation failed:", e);
      }
    }

    // ── 5. Cleanup old observations (>90 days) ──
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await db.agentObservation.deleteMany({
      where: { agentId: agent.id, createdAt: { lt: cutoff } },
    });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Processed ${competitors.length} competitors. ${observationsCreated} observations. ${errors.length} errors.`,
    };
  }

  private getCompetitors(agent: Agent): CompetitorDef[] {
    // Allow custom competitor list via agent config
    if (agent.config) {
      try {
        const config = JSON.parse(agent.config);
        if (config.competitorSlugs?.length) {
          return COMPETITORS.filter((c) => config.competitorSlugs.includes(c.slug));
        }
      } catch {}
    }
    return COMPETITORS;
  }

  private async processCompetitor(
    agentId: string,
    competitor: CompetitorDef,
    tokenBatch: Record<string, { price: number; marketCap: number; priceChange24hPct: number; volume24h: number }>
  ): Promise<number> {
    let count = 0;

    // ── Token data (from batch) ──
    if (competitor.coingeckoId && tokenBatch[competitor.coingeckoId]) {
      const tokenData = tokenBatch[competitor.coingeckoId];
      const prevPrice = await getMemory<number>(agentId, `${competitor.slug}:token_price`);
      const pctChange = prevPrice ? ((tokenData.price - prevPrice) / prevPrice) * 100 : 0;

      await db.agentObservation.create({
        data: {
          agentId,
          category: "token_data",
          subject: competitor.slug,
          data: JSON.stringify(tokenData),
          importance: Math.abs(pctChange) > 10 ? "high" : "normal",
        },
      });
      await setMemory(agentId, `${competitor.slug}:token_price`, tokenData.price);
      count++;
    }

    // ── Twitter activity ──
    if (competitor.twitterHandle) {
      const activity = await fetchTwitterActivity(competitor.twitterHandle, 10);
      if (activity.tweets.length > 0) {
        const lastKnownId = await getMemory<string>(agentId, `${competitor.slug}:twitter_latest_id`);
        const newTweets = lastKnownId
          ? activity.tweets.filter((t) => t.id > lastKnownId)
          : activity.tweets;

        if (newTweets.length > 0) {
          await db.agentObservation.create({
            data: {
              agentId,
              category: "twitter_activity",
              subject: competitor.slug,
              data: JSON.stringify({
                newTweetCount: newTweets.length,
                totalEngagement: activity.totalEngagement,
                topTweet: activity.topTweet,
                tweets: newTweets.slice(0, 5), // Store top 5
              }),
              importance: newTweets.length > 5 ? "high" : "normal",
            },
          });
          await setMemory(agentId, `${competitor.slug}:twitter_latest_id`, activity.tweets[0].id);
          count++;
        }
      }
    }

    // ── DefiLlama TVL ──
    if (competitor.defiLlamaSlug) {
      try {
        const tvlData = await fetchTVL(competitor.defiLlamaSlug);
        await db.agentObservation.create({
          data: {
            agentId,
            category: "tvl_fees",
            subject: competitor.slug,
            data: JSON.stringify(tvlData),
            importance: Math.abs(tvlData.tvlChange24hPct) > 10 ? "high" : "normal",
          },
        });
        count++;

        // Also fetch fees
        const feesData = await fetchFees(competitor.defiLlamaSlug);
        if (feesData.fees24h > 0) {
          await db.agentObservation.create({
            data: {
              agentId,
              category: "tvl_fees",
              subject: competitor.slug,
              data: JSON.stringify({ ...tvlData, ...feesData }),
            },
          });
          count++;
        }
      } catch (e) {
        console.warn(`[CompetitiveIntel] DefiLlama failed for ${competitor.slug}:`, e);
      }
    }

    // ── DappRadar (Phase 2 — gracefully skip if no key) ──
    if (competitor.dappRadarSlug) {
      const dappData = await fetchDappRadarData(competitor.dappRadarSlug);
      if (dappData) {
        await db.agentObservation.create({
          data: {
            agentId,
            category: "onchain_data",
            subject: competitor.slug,
            data: JSON.stringify(dappData),
          },
        });
        count++;
      }
    }

    // ── Dune (Phase 2 — gracefully skip if no key) ──
    if (competitor.duneQueryId) {
      const duneData = await fetchDuneData(competitor.duneQueryId);
      if (duneData) {
        await db.agentObservation.create({
          data: {
            agentId,
            category: "onchain_data",
            subject: competitor.slug,
            data: JSON.stringify(duneData),
          },
        });
        count++;
      }
    }

    return count;
  }

  private async generateDailySummary(
    observations: Array<{ category: string; subject: string; data: string; importance: string; createdAt: Date }>
  ): Promise<string> {
    const obsText = observations
      .map((o) => {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(o.data); } catch {}
        return `[${o.importance.toUpperCase()}] ${o.subject} — ${o.category}: ${JSON.stringify(parsed).slice(0, 200)}`;
      })
      .join("\n");

    const systemPrompt = `You are a competitive intelligence analyst for Snowy AI by Snowball Labs (an AI-powered sales engine).
Analyze the following observations about competitors and produce a concise daily briefing in markdown.
Focus on: product launches, significant social media activity, funding news, and any unusual patterns.
Highlight anything that Snowy AI should act on or be aware of.
Keep it under 500 words. Use bullet points and sections.`;

    const userMessage = `Here are today's competitive intelligence observations:\n\n${obsText}`;

    return await generate(systemPrompt, userMessage, 1024);
  }

  private async generateWeeklyReport(agentId: string): Promise<boolean> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const observations = await db.agentObservation.findMany({
      where: { agentId, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (observations.length === 0) return false;

    // Group by competitor
    const byCompetitor: Record<string, typeof observations> = {};
    for (const obs of observations) {
      if (!byCompetitor[obs.subject]) byCompetitor[obs.subject] = [];
      byCompetitor[obs.subject].push(obs);
    }

    const summaryParts = Object.entries(byCompetitor).map(([subject, obs]) => {
      return `## ${subject}\n${obs.map((o) => `- ${o.category}: ${o.data.slice(0, 150)}`).join("\n")}`;
    });

    const systemPrompt = `You are a competitive intelligence analyst for Snowy AI by Snowball Labs (an AI-powered sales engine).
Write a comprehensive weekly competitive report comparing all competitors.
Include: market position changes, notable product launches, content that performed well, funding news, adoption trends.
End with actionable recommendations for Snowy AI.
Use markdown with clear sections. Target ~800 words.`;

    const content = await generate(systemPrompt, summaryParts.join("\n\n"), 2048);

    await db.agentReport.create({
      data: {
        agentId,
        type: "weekly_comparative",
        title: `Weekly Competitive Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        content,
        data: JSON.stringify({
          competitorsAnalyzed: Object.keys(byCompetitor).length,
          totalObservations: observations.length,
          period: "7d",
        }),
      },
    });

    return true;
  }
}
