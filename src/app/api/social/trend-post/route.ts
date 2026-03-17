import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchTavilyNews, TavilyResult } from "@/lib/tavily";
import { generate } from "@/lib/ai";
import { postTweet, postThread } from "@/lib/twitter";
import { postLinkedInUpdate } from "@/lib/linkedin";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

const SNOWY_AI_CONTEXT = `Snowy AI by Snowball Labs — cloud-hosted OpenClaw platform.
- Starter: $12.5/mo — BYOK, 1-click integrations, agent hosting
- Pro: $39.5/mo — priority support, advanced analytics
- Enterprise: $79.5/mo — dedicated infra, custom SLA
- Website: agent.snowballlabs.org
- Key value: Deploy AI agents without infrastructure headaches. Bring your own keys, connect tools in 1 click.`;

const TREND_EXTRACTION_PROMPT = `You are a trend analyst. Analyze these community posts and news articles to identify the TOP 3 trending topics.

For each topic, provide:
1. A short topic title (3-6 words)
2. Why it's trending (1-2 sentences)
3. Key talking points (2-3 bullet points)

Format your response as JSON:
{
  "topics": [
    {
      "title": "Topic Title",
      "why": "Why it's trending",
      "talkingPoints": ["point 1", "point 2"]
    }
  ]
}

Return ONLY valid JSON, no markdown fences.`;

function buildValuePostPrompt(platform: "twitter" | "linkedin"): string {
  if (platform === "twitter") {
    return `You are a sharp tech commentator. Write a single compelling tweet (NOT a thread) about the given trending topic.

Rules:
- Pure value — insight, hot take, or useful perspective
- NO product mentions, NO promotions
- Under 280 characters
- NO hashtags
- Be conversational and opinionated, not generic
- Write ONLY the tweet text, nothing else`;
  }

  return `You are a sharp tech commentator. Write a LinkedIn post about the given trending topic.

Rules:
- Open with an attention-grabbing hook
- Give genuine insight — your informed take on the trend
- Under 1500 characters
- NO product mentions, NO promotions
- NO hashtags
- End with a thought-provoking question
- Write ONLY the post text, nothing else`;
}

function buildPromoPostPrompt(platform: "twitter" | "linkedin", snowyContext: string): string {
  if (platform === "twitter") {
    return `You are a tech founder sharing thoughts. Write a single tweet that starts with insight about the trending topic, then naturally connects to Snowy AI.

Snowy AI context:
${snowyContext}

Rules:
- Lead with the trend — don't open with product pitch
- Naturally transition: "this is why we built..." or "we're solving this with..."
- Under 280 characters
- NO hashtags
- Not salesy — founder sharing their work tone
- Include agent.snowballlabs.org only if it fits naturally
- Write ONLY the tweet text, nothing else`;
  }

  return `You are a tech founder sharing thoughts. Write a LinkedIn post that starts with insight about the trending topic, then naturally connects to Snowy AI.

Snowy AI context:
${snowyContext}

Rules:
- Open with the trend hook — NOT a product pitch
- Build genuine insight about the problem/opportunity
- Naturally transition to how Snowy AI addresses this
- Under 1500 characters
- NO hashtags
- "We built the solution" tone, not "buy our product"
- Include agent.snowballlabs.org
- End with engagement question
- Write ONLY the post text, nothing else`;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode: "analyze" | "generate" | "post" = body.mode || "post";
  const platforms: ("twitter" | "linkedin")[] = body.platforms || ["twitter", "linkedin"];
  const snowyContext: string = body.snowyContext || SNOWY_AI_CONTEXT;

  // If topics/posts are provided from the UI, use them directly
  const providedTopics = body.topics; // for generate mode
  const providedPosts = body.posts; // for post mode

  // ─── Step 1: Analyze Trends ───
  // Fetch recent community posts from DB
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const communityPosts = await db.communityPost.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { title: true, body: true, source: true, author: true },
  });

  // Also fetch trending news for extra context
  let newsArticles: TavilyResult[] = [];
  try {
    const results = await searchTavilyNews("AI agents developer tools trending", 5);
    newsArticles = results;
  } catch (err) {
    console.error("[TrendPost] Tavily search failed:", err);
  }

  // Build context for AI
  const communityContext = communityPosts
    .map((p) => `[${p.source}] ${p.title || ""}: ${(p.body || "").slice(0, 200)}`)
    .join("\n");

  const newsContext = newsArticles
    .map((a) => `[News] ${a.title}: ${a.content.slice(0, 200)}`)
    .join("\n");

  const analysisInput = `COMMUNITY POSTS (last 48h):\n${communityContext || "No recent posts"}\n\nTRENDING NEWS:\n${newsContext || "No news available"}`;

  // ─── Analyze Mode: Return extracted topics ───
  if (mode === "analyze") {
    try {
      const raw = await generate(TREND_EXTRACTION_PROMPT, analysisInput, 1024);
      const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        ok: true,
        topics: parsed.topics || [],
        communityPostCount: communityPosts.length,
        newsArticleCount: newsArticles.length,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: `Trend analysis failed: ${err.message}` },
        { status: 500 }
      );
    }
  }

  // ─── Generate Mode: Create post drafts for each topic ───
  const topics = providedTopics || [];
  if (mode === "generate") {
    if (topics.length === 0) {
      return NextResponse.json(
        { error: "No topics provided. Run analyze first." },
        { status: 400 }
      );
    }

    const drafts: Array<{
      topicTitle: string;
      platform: string;
      type: "value" | "promo";
      content: string;
    }> = [];

    for (const topic of topics) {
      const topicSummary = `Topic: ${topic.title}\nWhy trending: ${topic.why}\nKey points: ${topic.talkingPoints.join(", ")}`;

      for (const platform of platforms) {
        // Value post
        const valuePrompt = buildValuePostPrompt(platform);
        const valueContent = await generate(valuePrompt, topicSummary);
        drafts.push({
          topicTitle: topic.title,
          platform,
          type: "value",
          content: valueContent.trim(),
        });

        // Promo post
        const promoPrompt = buildPromoPostPrompt(platform, snowyContext);
        const promoContent = await generate(promoPrompt, topicSummary);
        drafts.push({
          topicTitle: topic.title,
          platform,
          type: "promo",
          content: promoContent.trim(),
        });
      }
    }

    return NextResponse.json({ ok: true, drafts });
  }

  // ─── Post Mode: Publish provided posts or run full pipeline ───
  const postsToPublish: Array<{
    platform: string;
    type: string;
    content: string;
    topicTitle: string;
  }> = providedPosts || [];

  // If no posts provided (automated run), do full pipeline
  if (postsToPublish.length === 0) {
    // Full automated pipeline: analyze → generate → post
    let autoTopics: Array<{ title: string; why: string; talkingPoints: string[] }> = [];
    try {
      const raw = await generate(TREND_EXTRACTION_PROMPT, analysisInput, 1024);
      const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      autoTopics = parsed.topics || [];
    } catch (err: any) {
      return NextResponse.json(
        { error: `Auto trend analysis failed: ${err.message}` },
        { status: 500 }
      );
    }

    if (autoTopics.length === 0) {
      return NextResponse.json({ ok: true, message: "No trends found", posted: 0 });
    }

    // Generate and collect all posts
    for (const topic of autoTopics) {
      const topicSummary = `Topic: ${topic.title}\nWhy trending: ${topic.why}\nKey points: ${topic.talkingPoints.join(", ")}`;

      for (const platform of platforms) {
        const valueContent = await generate(buildValuePostPrompt(platform), topicSummary);
        postsToPublish.push({
          platform,
          type: "value",
          content: valueContent.trim(),
          topicTitle: topic.title,
        });

        const promoContent = await generate(
          buildPromoPostPrompt(platform, snowyContext),
          topicSummary
        );
        postsToPublish.push({
          platform,
          type: "promo",
          content: promoContent.trim(),
          topicTitle: topic.title,
        });
      }
    }
  }

  // Get all active accounts for fan-out
  const allAccounts = await db.socialAccount.findMany({
    where: { status: "active", platform: { in: platforms } },
  });

  // Publish all posts — fan out to all active accounts per platform
  const results: Array<{
    topicTitle: string;
    platform: string;
    type: string;
    accountLabel?: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const post of postsToPublish) {
    const platformAccounts = allAccounts.filter((a) => a.platform === post.platform);
    if (platformAccounts.length === 0) {
      results.push({
        topicTitle: post.topicTitle,
        platform: post.platform,
        type: post.type,
        success: false,
        error: `${post.platform} account not connected.`,
      });
      continue;
    }

    for (const account of platformAccounts) {
      try {
        const socialPost = await db.socialPost.create({
          data: {
            platform: post.platform,
            content: post.content,
            status: "scheduled",
            socialAccountId: account.id,
          },
        });

        let externalId = "";
        if (post.platform === "twitter") {
          if (post.content.length > 280 && post.content.includes("\n\n")) {
            const parts = post.content.split("\n\n").filter((p) => p.trim());
            if (parts.length > 1) {
              const result = await postThread(parts, account.id);
              externalId = result.ids[0] || "";
            } else {
              const result = await postTweet(post.content.slice(0, 280), undefined, account.id);
              externalId = result.id;
            }
          } else {
            const result = await postTweet(post.content.slice(0, 280), undefined, account.id);
            externalId = result.id;
          }
        } else if (post.platform === "linkedin") {
          const result = await postLinkedInUpdate(post.content, account.id);
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
              platform: post.platform,
              externalId,
              socialAccountId: account.id,
              accountLabel: account.label,
              source: "trend_post",
              postType: post.type,
              topicTitle: post.topicTitle,
            }),
          },
        });

        results.push({
          topicTitle: post.topicTitle,
          platform: post.platform,
          type: post.type,
          accountLabel: account.label,
          success: true,
        });
      } catch (err: any) {
        results.push({
          topicTitle: post.topicTitle,
          platform: post.platform,
          type: post.type,
          accountLabel: account.label,
          success: false,
          error: err?.message || String(err),
        });
        console.error(`[TrendPost] Failed ${post.platform}/${account.label} ${post.type} for "${post.topicTitle}":`, err);
      }
    }
  }

  const posted = results.filter((r) => r.success).length;
  return NextResponse.json({ ok: true, posted, total: results.length, results });
}
