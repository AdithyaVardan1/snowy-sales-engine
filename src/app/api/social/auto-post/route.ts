import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchTavilyNews, TavilyResult } from "@/lib/tavily";
import { generate } from "@/lib/ai";
import { postTweet, postThread } from "@/lib/twitter";
import { postLinkedInUpdate } from "@/lib/linkedin";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

const DEFAULT_TOPICS = [
  "AI agents LLMs latest news",
  "developer tools open source trending",
  "self-hosting Docker deployment news",
];

function buildSystemPrompt(platform: "twitter" | "linkedin"): string {
  if (platform === "twitter") {
    return `You are a tech content creator. Given a news article summary, write a compelling Twitter thread (2-4 tweets).

STRICT FORMAT RULES — follow exactly:
- Separate each tweet with a line containing ONLY: ---
- Each tweet segment MUST contain the full tweet text (number + content together)
- If numbering, write the number (1/) on the FIRST LINE of the segment, then content on next lines — all BEFORE the next ---
- NEVER put --- immediately after just a number like "2/" alone
- Each tweet must be under 280 characters total
- Be insightful — add your take, don't just summarize
- Include the article URL in the last tweet
- DO NOT use any hashtags — they look unprofessional
- Mention Snowy AI only if directly relevant

CORRECT example:
1/
Hook sentence here.

---
2/
Insight and detail here.
Can span multiple lines within the tweet.

---
3/
Final take + URL: https://example.com`;
  }

  return `You are a tech content creator. Given a news article summary, write a compelling LinkedIn post.
Rules:
- Open with an attention-grabbing hook line
- Give your informed take on why this matters
- Keep under 2000 characters total
- Include the article URL
- Be professional but opinionated
- End with a question to drive engagement
- DO NOT use any hashtags — they look unprofessional
- Mention Snowy AI only if directly relevant to the topic`;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const platforms: ("twitter" | "linkedin")[] = body.platforms || ["twitter", "linkedin"];
  const topics: string[] = body.topics || DEFAULT_TOPICS;
  const maxArticles: number = body.maxArticlesPerRun || 3;

  // 1. Search for news across all topics
  const allResults: TavilyResult[] = [];
  for (const topic of topics) {
    try {
      const results = await searchTavilyNews(topic, 2);
      allResults.push(...results);
    } catch (err) {
      console.error(`[AutoPost] Tavily search failed for "${topic}":`, err);
    }
  }

  // 2. Deduplicate by URL and sort by score
  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  const sortedArticles = unique.sort((a, b) => b.score - a.score);

  if (sortedArticles.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No news articles found",
      posted: 0,
    });
  }

  // 3. Find which platforms each article has already been successfully posted to
  const articleSuccessfulPlatforms = new Map<string, Set<string>>();

  for (const article of sortedArticles) {
    const existingPosts = await db.socialPost.findMany({
      where: {
        OR: [
          { content: { contains: article.url } },
          { threadParts: { contains: article.url } },
        ],
        status: "posted",
      },
      select: { platform: true },
    });
    const successfulPlatforms = new Set(existingPosts.map((p) => p.platform));
    articleSuccessfulPlatforms.set(article.url, successfulPlatforms);
  }

  // Filter down to articles that still need to be posted to at least one platform
  const actionableArticles = sortedArticles.filter((article) => {
    const successful = articleSuccessfulPlatforms.get(article.url) || new Set();
    const isFullyPosted = platforms.every((p) => successful.has(p));
    if (isFullyPosted) {
      console.log(`[AutoPost] Skipping fully-posted article: ${article.title}`);
    }
    return !isFullyPosted;
  });

  // Now take the top N that are actually actionable
  const top = actionableArticles.slice(0, maxArticles);

  if (top.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "All fetched articles were already fully posted to all platforms",
      posted: 0,
    });
  }

  // 4. Get all active accounts per platform for fan-out
  const allAccounts = await db.socialAccount.findMany({
    where: { status: "active", platform: { in: platforms } },
  });

  // 5. Generate and post for each article × platform × account
  const results: Array<{
    article: string;
    platform: string;
    accountLabel?: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const article of top) {
    const successfulPlatforms = articleSuccessfulPlatforms.get(article.url) || new Set();

    const userMessage = `Article: "${article.title}"\nSummary: ${article.content}\nURL: ${article.url}`;

    for (const platform of platforms) {
      if (successfulPlatforms.has(platform)) {
        console.log(`[AutoPost] Skipping ${platform} logic for: ${article.title} (already posted)`);
        continue;
      }

      // Get accounts for this platform (fan-out to all active accounts)
      const platformAccounts = allAccounts.filter((a) => a.platform === platform);
      if (platformAccounts.length === 0) {
        results.push({
          article: article.title,
          platform,
          success: false,
          error: `${platform} account not connected. Add your cookies in Social settings.`,
        });
        continue;
      }

      try {
        const systemPrompt = buildSystemPrompt(platform);
        const content = await generate(systemPrompt, userMessage);

        let threadParts: string[] | null = null;
        if (platform === "twitter" && content.includes("---")) {
          const parts = content
            .split("---")
            .map((t) => t.trim())
            .filter((t) => t.length > 0 && !/^\d+\/\s*$/.test(t));
          if (parts.length > 1) threadParts = parts;
        }

        // Post to each account for this platform
        for (const account of platformAccounts) {
          try {
            const socialPost = await db.socialPost.create({
              data: {
                platform,
                content: threadParts ? threadParts[0] : content,
                threadParts: threadParts ? JSON.stringify(threadParts) : null,
                status: "scheduled",
                socialAccountId: account.id,
              },
            });

            let externalId = "";
            if (platform === "twitter") {
              if (threadParts && threadParts.length > 1) {
                const result = await postThread(threadParts, account.id);
                externalId = result.ids[0] || "";
              } else {
                const text = threadParts?.[0] || content;
                const result = await postTweet(text, undefined, account.id);
                externalId = result.id;
              }
            } else if (platform === "linkedin") {
              const result = await postLinkedInUpdate(content, account.id);
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
                  socialAccountId: account.id,
                  accountLabel: account.label,
                  source: "auto_post_tech",
                  articleTitle: article.title,
                  articleUrl: article.url,
                }),
              },
            });

            results.push({ article: article.title, platform, accountLabel: account.label, success: true });
          } catch (err: any) {
            results.push({
              article: article.title,
              platform,
              accountLabel: account.label,
              success: false,
              error: err?.message || String(err),
            });
            console.error(`[AutoPost] Failed ${platform}/${account.label} for "${article.title}":`, err?.message);
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        results.push({ article: article.title, platform, success: false, error: errMsg });
        console.error(`[AutoPost] Failed ${platform} for "${article.title}":`, errMsg);
      }
    }
  }

  const posted = results.filter((r) => r.success).length;
  return NextResponse.json({ ok: true, posted, total: results.length, results });
}
