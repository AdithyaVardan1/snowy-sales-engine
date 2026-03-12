import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { postTweet } from "../../twitter";
import { postLinkedInUpdate } from "../../linkedin";
import { searchTavilyNews } from "../../tavily";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

/**
 * Social Media Agent
 *
 * Runs every 4 hours to:
 * 1. Search for trending AI/tech news via Tavily
 * 2. Generate platform-specific social content via AI
 * 3. Post to Twitter and LinkedIn
 * 4. Track posting metrics and engagement
 * 5. Generate daily content performance report
 */
export class SocialMediaRunner implements AgentRunner {
  slug = "social_media";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    // ── 1. Fetch trending topics ──
    const topics = [
      "AI agents deployment cloud",
      "developer tools automation trending",
      "open source AI infrastructure",
    ];

    const articles: Array<{ title: string; url: string; content: string }> = [];
    for (const topic of topics) {
      try {
        const results = await searchTavilyNews(topic, 2);
        articles.push(...results.map((r) => ({ title: r.title, url: r.url, content: r.content })));
      } catch (e) {
        errors.push(`Tavily "${topic}": ${e}`);
      }
    }

    if (articles.length === 0) {
      return { observationsCreated: 0, reportsCreated: 0, summary: "No news articles found to post about." };
    }

    await db.agentObservation.create({
      data: {
        agentId: agent.id,
        category: "news_scan",
        subject: "articles_found",
        data: JSON.stringify({ count: articles.length, titles: articles.map((a) => a.title) }),
      },
    });
    observationsCreated++;

    // ── 2. Check what we already posted ──
    const recentPosts = await db.socialPost.findMany({
      where: { status: "posted", postedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { content: true },
    });
    const recentText = recentPosts.map((p) => p.content).join(" ");

    // Filter out articles we already posted about
    const fresh = articles.filter((a) => !recentText.includes(a.url));
    const article = fresh[0] || articles[0];

    // ── 3. Generate and post content ──
    const platforms: ("twitter" | "linkedin")[] = ["twitter", "linkedin"];
    let posted = 0;

    for (const platform of platforms) {
      try {
        const systemPrompt = platform === "twitter"
          ? `You are a sharp tech commentator. Write a single compelling tweet about this article. Rules: under 280 characters, no hashtags, be opinionated and insightful, include the URL. Write ONLY the tweet.`
          : `You are a tech thought leader. Write a LinkedIn post about this article. Rules: under 1500 characters, no hashtags, open with a hook, give your take, include the URL, end with a question. Write ONLY the post.`;

        const content = await generate(systemPrompt, `Article: "${article.title}"\nSummary: ${article.content.slice(0, 500)}\nURL: ${article.url}`);

        // Create social post record
        const socialPost = await db.socialPost.create({
          data: { platform, content: content.trim(), status: "scheduled" },
        });

        // Post
        let externalId = "";
        if (platform === "twitter") {
          const result = await postTweet(content.trim().slice(0, 280));
          externalId = result.id;
        } else {
          const result = await postLinkedInUpdate(content.trim());
          externalId = result.id || "";
        }

        await db.socialPost.update({
          where: { id: socialPost.id },
          data: { status: "posted", postedAt: new Date(), externalId, error: null },
        });

        await db.activityLog.create({
          data: {
            type: "content_published",
            channel: "social_media",
            details: JSON.stringify({
              socialPostId: socialPost.id,
              platform,
              externalId,
              source: "social_media_agent",
              articleTitle: article.title,
            }),
          },
        });

        posted++;
      } catch (e) {
        errors.push(`Post ${platform}: ${e}`);
      }
    }

    if (posted > 0) {
      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "content_posted",
          subject: "social_post",
          data: JSON.stringify({ article: article.title, platforms: platforms.slice(0, posted), posted }),
          importance: "normal",
        },
      });
      observationsCreated++;
    }

    // ── 4. Track posting metrics ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayPosts = await db.socialPost.count({
      where: { status: "posted", postedAt: { gte: todayStart } },
    });

    const prevCount = await getMemory<number>(agent.id, "daily_post_count") ?? 0;
    await setMemory(agent.id, "daily_post_count", todayPosts);
    await setMemory(agent.id, "last_article_url", article.url);

    // ── 5. Daily report (once per day) ──
    const lastReportDate = await getMemory<string>(agent.id, "last_report_date");
    const today = new Date().toISOString().split("T")[0];

    if (lastReportDate !== today) {
      try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekPosts = await db.socialPost.findMany({
          where: { status: "posted", postedAt: { gte: weekAgo } },
          select: { platform: true, content: true, postedAt: true },
        });

        const platformCounts: Record<string, number> = {};
        weekPosts.forEach((p) => { platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1; });

        const briefing = await generate(
          `You are a social media analytics assistant. Write a brief daily content report in markdown. Include: posts today, weekly total, platform breakdown, and content recommendations. Keep under 300 words.`,
          `Posts today: ${todayPosts}\nWeekly posts: ${weekPosts.length}\nPlatform breakdown: ${JSON.stringify(platformCounts)}\nLatest article: ${article.title}`,
          512
        );

        await db.agentReport.create({
          data: {
            agentId: agent.id,
            type: "daily_summary",
            title: `Social Media Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            content: briefing,
            data: JSON.stringify({ todayPosts, weeklyPosts: weekPosts.length, platformCounts }),
          },
        });
        reportsCreated++;
        await setMemory(agent.id, "last_report_date", today);
      } catch (e) {
        errors.push(`Report: ${e}`);
      }
    }

    // Cleanup old observations
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Posted ${posted} social updates about "${article.title}". ${errors.length} errors.`,
    };
  }
}
