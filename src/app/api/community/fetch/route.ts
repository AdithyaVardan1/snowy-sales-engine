import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchGitHubIssues, fetchGitHubDiscussions } from "@/lib/github";
import { fetchAllSubreddits } from "@/lib/reddit";
import { searchTweetsViaTwikit } from "@/lib/twikit";
import { fetchLinkedInPosts } from "@/lib/linkedin-search";

export async function POST(request: NextRequest) {
  const { source } = await request.json();

  let rawPosts: Array<{
    externalId: string;
    source: string;
    subreddit?: string;
    title: string;
    body: string;
    author: string;
    url: string;
  }> = [];

  if (source === "github" || source === "all") {
    const [issues, discussions] = await Promise.all([
      fetchGitHubIssues(),
      fetchGitHubDiscussions(),
    ]);
    rawPosts.push(...issues, ...discussions);
  }

  if (source === "reddit" || source === "all") {
    const redditPosts = await fetchAllSubreddits();
    rawPosts.push(...redditPosts);
  }

  if (source === "linkedin" || source === "all") {
    try {
      const settings = await db.appSetting.findUnique({
        where: { key: "KEYWORDS" }
      });
      const keywords = settings?.value
        ? settings.value.split(",").map((k: string) => k.trim()).filter(Boolean)
        : ["snowy ai", "snowball labs", "AI sales agent"];

      const linkedinPosts = await fetchLinkedInPosts(keywords);
      rawPosts.push(...linkedinPosts);
    } catch (e) {
      console.error("[Community] Failed to fetch LinkedIn posts:", e);
    }
  }

  if (source === "twitter" || source === "all") {
    try {
      const settings = await db.appSetting.findUnique({
        where: { key: "KEYWORDS" }
      });
      const keywords = settings?.value
        ? settings.value.split(",").map((k: string) => k.trim()).filter(Boolean)
        : ["snowy ai", "snowball labs", "AI sales agent"]; // fallback

      const query = keywords.join(" OR ");
      // Exclude retweets and filter to English tweets only
      const cleanQuery = `${query} -filter:retweets lang:en`;

      const tweets = await searchTweetsViaTwikit(cleanQuery, 20);

      const mappedTweets = (tweets || []).map((t) => ({
        externalId: `twitter_${t.id}`,
        source: "twitter",
        title: t.text.substring(0, 100) + (t.text.length > 100 ? "..." : ""),
        body: t.text,
        author: t.authorHandle || t.author,
        url: t.url,
      }));

      rawPosts.push(...mappedTweets);
    } catch (e) {
      console.error("[Community] Failed to fetch Twitter posts:", e);
    }
  }

  // Shuffle the rawPosts array so that when we insert them, the fetchedAt timestamps
  // are randomly distributed across sources, creating a mixed feed for the user.
  for (let i = rawPosts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rawPosts[i], rawPosts[j]] = [rawPosts[j], rawPosts[i]];
  }

  // Upsert: skip duplicates by externalId
  let newCount = 0;
  for (const post of rawPosts) {
    try {
      await db.communityPost.upsert({
        where: { externalId: post.externalId },
        update: {}, // Don't update existing posts
        create: {
          externalId: post.externalId,
          source: post.source,
          subreddit: post.subreddit,
          title: post.title,
          body: post.body,
          author: post.author,
          url: post.url,
        },
      });
      newCount++;
    } catch (e: any) {
      // Skip if duplicate (race condition)
      if (!e.message?.includes("Unique constraint")) {
        console.error("Failed to upsert post:", e);
      }
    }
  }

  const total = await db.communityPost.count();

  return NextResponse.json({
    fetched: rawPosts.length,
    new: newCount,
    total,
    sources: source,
  });
}
