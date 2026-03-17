/**
 * LinkedIn community monitoring — search public posts by keyword.
 * Uses LinkedIn's internal Voyager API with li_at session cookie
 * (same auth pattern as our Twitter/Twikit integration).
 *
 * Cookie is read from the SocialAccount table (platform: "linkedin").
 */

import { db } from "./db";

interface LinkedInPost {
  id: string;
  text: string;
  author: string;
  authorHeadline?: string;
  url: string;
  timestamp?: number;
}

const VOYAGER_BASE = "https://www.linkedin.com/voyager/api";

async function getLinkedInCookie(accountId?: string): Promise<string> {
  let account;
  if (accountId) {
    account = await db.socialAccount.findUnique({ where: { id: accountId } });
  } else {
    account = await db.socialAccount.findFirst({
      where: { platform: "linkedin", isDefault: true, status: "active" },
    }) || await db.socialAccount.findFirst({
      where: { platform: "linkedin", status: "active" },
    });
  }

  if (account && account.status === "active") {
    const cookies = JSON.parse(account.cookies) as Record<string, string>;
    if (cookies.li_at) return cookies.li_at;
  }

  // Fall back to env var
  const envCookie = process.env.LINKEDIN_LI_AT;
  if (envCookie) return envCookie;

  throw new Error(
    "LinkedIn li_at cookie not configured. Add it in Settings → Social → LinkedIn, or set LINKEDIN_LI_AT in .env.local"
  );
}

/**
 * Search LinkedIn posts by keyword using the Voyager content search API.
 */
export async function searchLinkedInPosts(
  query: string,
  count: number = 20
): Promise<LinkedInPost[]> {
  const liAt = await getLinkedInCookie();

  const params = new URLSearchParams({
    q: "all",
    keywords: query,
    origin: "GLOBAL_SEARCH_HEADER",
    start: "0",
    count: String(count),
    "queryContext": "List(spellCorrectionEnabled->true,relatedSearchesEnabled->true)",
    "filters": "List(resultType->CONTENT)",
    decorationId:
      "com.linkedin.voyager.dash.deco.search.SearchClusterCollection-175",
  });

  const url = `${VOYAGER_BASE}/search/dash/clusters?${params}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
      "x-li-lang": "en_US",
      "x-restli-protocol-version": "2.0.0",
      Cookie: `li_at=${liAt}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // Mark cookie as expired
      const acct = await db.socialAccount.findFirst({ where: { platform: "linkedin", isDefault: true } });
      if (acct) await db.socialAccount.update({ where: { id: acct.id }, data: { status: "expired" } }).catch(() => {});
      throw new Error("LinkedIn session expired. Please update your li_at cookie in Settings.");
    }
    throw new Error(`LinkedIn search failed: ${res.status}`);
  }

  const data = await res.json();
  const posts: LinkedInPost[] = [];

  try {
    // The Voyager response includes entities in the `included` array
    const included = data.included || [];

    for (const entity of included) {
      // Look for feed update entities that contain post content
      if (entity.$type === "com.linkedin.voyager.dash.search.EntityResultViewModel" ||
          entity.$type === "com.linkedin.voyager.feed.render.UpdateV2") {

        const commentary = entity.commentary?.text?.text ||
                          entity.summary?.text ||
                          entity.commentary?.text ||
                          "";

        if (!commentary || typeof commentary !== "string") continue;

        const actorName = entity.actorNavigationContext?.title ||
                         entity.title?.text ||
                         entity.actorName ||
                         "Unknown";

        const actorHeadline = entity.actorNavigationContext?.subtitle ||
                             entity.headline?.text ||
                             entity.primarySubtitle?.text ||
                             "";

        // Build LinkedIn post URL
        const entityUrn = entity.entityUrn || entity.trackingUrn || "";
        const activityId = entityUrn.includes("activity:")
          ? entityUrn.split("activity:")[1]?.split(",")[0]
          : entity.socialDetail?.urn?.split("activity:")[1] || "";

        const postUrl = activityId
          ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`
          : entity.navigationUrl || "";

        if (!postUrl) continue;

        posts.push({
          id: activityId || entityUrn || `li_${Date.now()}_${posts.length}`,
          text: commentary,
          author: typeof actorName === "string" ? actorName : "Unknown",
          authorHeadline: typeof actorHeadline === "string" ? actorHeadline : undefined,
          url: postUrl,
          timestamp: entity.createdAt || entity.publishedAt,
        });
      }
    }

    // Also try extracting from search results clusters
    const elements = data.data?.searchDashClustersByAll?.elements ||
                    data.elements || [];

    for (const cluster of elements) {
      const items = cluster.items || [];
      for (const item of items) {
        const result = item.item?.entityResult;
        if (!result) continue;

        const title = result.title?.text || "";
        const summary = result.summary?.text || "";
        const text = summary || title;
        if (!text) continue;

        const authorName = result.title?.text ||
                          result.primarySubtitle?.text ||
                          "Unknown";

        const navUrl = result.navigationUrl || "";

        // Deduplicate
        if (posts.some(p => p.url === navUrl)) continue;

        const urn = result.entityUrn || result.trackingUrn || "";
        const id = urn.split(":").pop() || `li_${Date.now()}_${posts.length}`;

        posts.push({
          id,
          text: text.substring(0, 3000),
          author: authorName,
          authorHeadline: result.primarySubtitle?.text,
          url: navUrl || `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}`,
          timestamp: undefined,
        });
      }
    }
  } catch (parseErr) {
    console.error("[LinkedIn] Failed to parse search results:", parseErr);
  }

  return posts.slice(0, count);
}

/**
 * Fetch LinkedIn posts and map to the community post format.
 */
export async function fetchLinkedInPosts(keywords: string[]): Promise<
  Array<{
    externalId: string;
    source: string;
    title: string;
    body: string;
    author: string;
    url: string;
  }>
> {
  const query = keywords.join(" OR ");
  const posts = await searchLinkedInPosts(query, 20);

  return posts.map((p) => ({
    externalId: `linkedin_${p.id}`,
    source: "linkedin",
    title: p.text.substring(0, 100) + (p.text.length > 100 ? "..." : ""),
    body: p.text.substring(0, 3000),
    author: p.author,
    url: p.url,
  }));
}
