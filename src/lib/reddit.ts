import { XMLParser } from "fast-xml-parser";
import { getSetting } from "./config";

interface RawPost {
  externalId: string;
  source: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  url: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchRedditPosts(
  subreddit: string,
  searchQuery?: string
): Promise<RawPost[]> {
  const url = searchQuery
    ? `https://www.reddit.com/r/${subreddit}/search.rss?q=${encodeURIComponent(searchQuery)}&sort=new&t=week`
    : `https://www.reddit.com/r/${subreddit}/new.rss?limit=25`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SnowyAI-SalesEngine/1.0" },
    });

    if (!res.ok) {
      console.error(`Reddit RSS error for r/${subreddit}:`, res.status);
      return [];
    }

    const xml = await res.text();
    const parsed = parser.parse(xml);

    const entries = parsed?.feed?.entry;
    if (!entries) return [];

    const items = Array.isArray(entries) ? entries : [entries];

    return items.map((entry: any) => ({
      externalId: `reddit_${entry.id || entry.link?.["@_href"] || Math.random()}`,
      source: "reddit",
      subreddit: `r/${subreddit}`,
      title: entry.title || "Untitled",
      body: extractContent(entry.content?.["#text"] || entry.summary?.["#text"] || ""),
      author: entry.author?.name || entry["@_author"] || "unknown",
      url: entry.link?.["@_href"] || "",
    }));
  } catch (e) {
    console.error(`Reddit fetch failed for r/${subreddit}:`, e);
    return [];
  }
}

export async function fetchAllSubreddits(): Promise<RawPost[]> {
  const raw = await getSetting("MONITORED_SUBREDDITS") ?? "openclaw,selfhosted,LocalLLaMA";
  const subreddits = raw.split(",");

  const results = await Promise.all(
    subreddits.map((sub) => {
      const trimmed = sub.trim();
      // For openclaw subreddit, fetch all new posts
      // For others, search for "openclaw" mentions
      if (trimmed.toLowerCase() === "openclaw") {
        return fetchRedditPosts(trimmed);
      }
      return fetchRedditPosts(trimmed, "openclaw");
    })
  );

  return results.flat();
}

function extractContent(html: string): string {
  // Strip HTML tags for plain text
  let text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'") // Added support for standard apostrophe entity
    .replace(/\s+/g, " ")
    .trim();

  // Cleanly truncate up to 3000 chars without chopping mid-word
  if (text.length > 3000) {
    const sliced = text.slice(0, 3000);
    const lastSpace = sliced.lastIndexOf(" ");
    text = (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced) + "...";
  }
  return text;
}
