import { TwitterActivity } from "../types";

/**
 * Fetch recent Twitter activity for a competitor.
 * Wraps the existing twikit bridge. Handles errors gracefully
 * since Twitter search may fail due to rate limits or cookie issues.
 */
export async function fetchTwitterActivity(
  twitterHandle: string,
  count: number = 20
): Promise<TwitterActivity> {
  try {
    // Dynamic import to avoid loading twikit unless needed
    const { searchTweetsViaTwikit } = await import("../../twikit");

    const tweets = await searchTweetsViaTwikit(`from:${twitterHandle}`, count);
    const tweetList = tweets ?? [];

    const totalEngagement = tweetList.reduce(
      (sum, t) => sum + (t.likeCount || 0) + (t.retweetCount || 0) + (t.replyCount || 0),
      0
    );

    const topTweet = tweetList.length > 0
      ? tweetList.reduce((best, t) => {
          const score = (t.likeCount || 0) + (t.retweetCount || 0);
          const bestScore = (best.likeCount || 0) + (best.retweetCount || 0);
          return score > bestScore ? t : best;
        })
      : null;

    return {
      tweets: tweetList.map((t) => ({
        id: t.id,
        text: t.text,
        author: t.author,
        authorHandle: t.authorHandle,
        createdAt: t.createdAt,
        replyCount: t.replyCount || 0,
        retweetCount: t.retweetCount || 0,
        likeCount: t.likeCount || 0,
        url: t.url,
      })),
      totalEngagement,
      topTweet: topTweet
        ? {
            id: topTweet.id,
            text: topTweet.text,
            likeCount: topTweet.likeCount || 0,
            retweetCount: topTweet.retweetCount || 0,
            url: topTweet.url,
          }
        : null,
    };
  } catch (error) {
    console.warn(`[CompetitiveIntel] Twitter fetch failed for @${twitterHandle}:`, error);
    return { tweets: [], totalEngagement: 0, topTweet: null };
  }
}
