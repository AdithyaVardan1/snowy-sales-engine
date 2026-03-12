import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchTweetsViaTwikit } from "@/lib/twikit";
import { searchLinkedInPosts } from "@/lib/linkedin-search";

export interface DiscoveredProspect {
  name: string;
  handle: string;
  platform: string;
  profileUrl: string;
  followers: number;
  bio: string;
  recentPost: string;
  engagement: number;
  alreadyExists: boolean;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const platform: string = body.platform || "twitter";
  const query: string = body.query || "";
  const count: number = body.count || 20;

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // Get existing partners to flag duplicates
  const existingPartners = await db.partner.findMany({
    select: { name: true, profileUrl: true },
  });
  const existingNames = new Set(existingPartners.map((p) => p.name.toLowerCase()));
  const existingUrls = new Set(
    existingPartners.map((p) => p.profileUrl?.toLowerCase()).filter(Boolean)
  );

  const prospects: DiscoveredProspect[] = [];

  if (platform === "twitter") {
    try {
      const tweets = await searchTweetsViaTwikit(query, count);
      if (!tweets) {
        return NextResponse.json({ prospects: [], message: "No tweets found" });
      }

      // Group by author to deduplicate
      const authorMap = new Map<
        string,
        { name: string; handle: string; tweets: typeof tweets; totalEngagement: number }
      >();

      for (const tweet of tweets) {
        const handle = tweet.authorHandle || tweet.author;
        if (!handle) continue;

        const existing = authorMap.get(handle.toLowerCase()) || {
          name: tweet.author,
          handle: tweet.authorHandle,
          tweets: [],
          totalEngagement: 0,
        };
        existing.tweets.push(tweet);
        existing.totalEngagement +=
          (tweet.likeCount || 0) + (tweet.retweetCount || 0) + (tweet.replyCount || 0);
        authorMap.set(handle.toLowerCase(), existing);
      }

      for (const data of Array.from(authorMap.values())) {
        const profileUrl = `https://x.com/${data.handle}`;
        const bestTweet = data.tweets.sort(
          (a: { likeCount?: number; retweetCount?: number }, b: { likeCount?: number; retweetCount?: number }) =>
            (b.likeCount || 0) + (b.retweetCount || 0) -
            ((a.likeCount || 0) + (a.retweetCount || 0))
        )[0];

        prospects.push({
          name: data.name,
          handle: data.handle,
          platform: "twitter",
          profileUrl,
          followers: 0, // Twitter search doesn't return follower count
          bio: "",
          recentPost: bestTweet?.text || "",
          engagement: data.totalEngagement,
          alreadyExists:
            existingNames.has(data.name.toLowerCase()) ||
            existingNames.has(data.handle.toLowerCase()) ||
            existingUrls.has(profileUrl.toLowerCase()),
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[Discover] Twitter search error:", msg);
      // Return partial results if we have any, with the error
      return NextResponse.json(
        { prospects: [], error: `Twitter search failed: ${msg}` },
        { status: 200 }
      );
    }
  } else if (platform === "linkedin") {
    try {
      const posts = await searchLinkedInPosts(query, count);

      // Group by author
      const authorMap = new Map<
        string,
        { name: string; headline: string; posts: typeof posts }
      >();

      for (const post of posts) {
        if (!post.author || post.author === "Unknown") continue;
        const existing = authorMap.get(post.author.toLowerCase()) || {
          name: post.author,
          headline: post.authorHeadline || "",
          posts: [],
        };
        existing.posts.push(post);
        authorMap.set(post.author.toLowerCase(), existing);
      }

      for (const data of Array.from(authorMap.values())) {
        prospects.push({
          name: data.name,
          handle: data.name,
          platform: "linkedin",
          profileUrl: "",
          followers: 0,
          bio: data.headline,
          recentPost: data.posts[0]?.text?.slice(0, 300) || "",
          engagement: data.posts.length,
          alreadyExists: existingNames.has(data.name.toLowerCase()),
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[Discover] LinkedIn search error:", msg);
      return NextResponse.json(
        { prospects: [], error: `LinkedIn search failed: ${msg}` },
        { status: 200 }
      );
    }
  } else {
    return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  // Sort by engagement descending
  prospects.sort((a, b) => b.engagement - a.engagement);

  return NextResponse.json({ prospects, total: prospects.length });
}
