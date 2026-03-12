import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generate } from "@/lib/ai";

const TARGET_SITE = "https://agent.snowballlabs.org";

interface PageData {
  url: string;
  status: number;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  h3: string[];
  images: { src: string; alt: string }[];
  links: { href: string; text: string; isExternal: boolean }[];
  wordCount: number;
  hasCanonical: boolean;
  canonicalUrl: string;
  hasRobotsMeta: boolean;
  robotsContent: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  structuredData: string[];
  loadTimeMs: number;
  htmlSize: number;
}

// Simple HTML tag extractor (no external parser needed)
function extractTag(html: string, regex: RegExp): string[] {
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push(m[1].trim());
  }
  return matches;
}

function extractMeta(html: string, name: string): string {
  const regex = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return match[1];
  // Try reverse order (content before name)
  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : "";
}

async function scrapePage(url: string): Promise<(PageData & { _html: string }) | null> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    const html = await res.text();
    const loadTimeMs = Date.now() - start;

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Meta description
    const metaDescription = extractMeta(html, "description");

    // Headings
    const h1 = extractTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    const h2 = extractTag(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi);
    const h3 = extractTag(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi);

    // Strip HTML tags from headings
    const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").trim();
    const cleanH1 = h1.map(stripTags).filter(Boolean);
    const cleanH2 = h2.map(stripTags).filter(Boolean);
    const cleanH3 = h3.map(stripTags).filter(Boolean);

    // Images
    const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
    const images: { src: string; alt: string }[] = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i);
      images.push({ src: imgMatch[1], alt: altMatch ? altMatch[1] : "" });
    }

    // Links
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const links: { href: string; text: string; isExternal: boolean }[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const href = linkMatch[1];
      const text = linkMatch[2].replace(/<[^>]*>/g, "").trim();
      const isExternal =
        href.startsWith("http") && !href.includes("snowballlabs.org");
      links.push({ href, text, isExternal });
    }

    // Word count (strip all tags, count words)
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = textContent.split(" ").filter(Boolean).length;

    // Canonical
    const canonicalMatch = html.match(
      /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i
    );
    const hasCanonical = !!canonicalMatch;
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : "";

    // Robots meta
    const robotsContent = extractMeta(html, "robots");
    const hasRobotsMeta = !!robotsContent;

    // Open Graph
    const ogTitle = extractMeta(html, "og:title");
    const ogDescription = extractMeta(html, "og:description");
    const ogImage = extractMeta(html, "og:image");
    const twitterCard = extractMeta(html, "twitter:card");

    // Structured data (JSON-LD)
    const ldRegex =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const structuredData: string[] = [];
    let ldMatch;
    while ((ldMatch = ldRegex.exec(html)) !== null) {
      structuredData.push(ldMatch[1].trim());
    }

    return {
      url,
      status: res.status,
      title,
      metaDescription,
      h1: cleanH1,
      h2: cleanH2,
      h3: cleanH3,
      images,
      links,
      wordCount,
      hasCanonical,
      canonicalUrl,
      hasRobotsMeta,
      robotsContent,
      ogTitle,
      ogDescription,
      ogImage,
      twitterCard,
      structuredData,
      loadTimeMs,
      htmlSize: html.length,
      _html: html,
    };
  } catch (e) {
    console.error(`[SEO] Failed to scrape ${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function discoverInternalLinks(
  html: string,
  baseUrl: string
): string[] {
  const linkRegex = /href=["']([^"'#]*?)["']/gi;
  const urls = new Set<string>();
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    let href = m[1];
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:"))
      continue;
    if (href.startsWith("/")) {
      href = baseUrl + href;
    }
    if (href.startsWith(baseUrl)) {
      // Normalize
      const u = new URL(href);
      urls.add(u.origin + u.pathname.replace(/\/$/, "") || "/");
    }
  }
  return Array.from(urls);
}

/**
 * POST /api/seo/analyze
 * Scrapes the target site, runs AI analysis, saves recommendations.
 * Body (optional): { url?: string, maxPages?: number }
 */
export async function POST(request: NextRequest) {
  try {
    return await runAnalysis(request);
  } catch (e) {
    console.error("[SEO] Unhandled error:", e);
    return NextResponse.json({
      error: "SEO scan failed: " + (e instanceof Error ? e.message : String(e)),
    });
  }
}

async function runAnalysis(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const siteUrl: string = body.url || TARGET_SITE;
  const maxPages: number = Math.min(body.maxPages || 20, 50);

  // Step 1: Crawl site pages
  const visited = new Set<string>();
  const toVisit = [siteUrl.replace(/\/$/, "")];
  const pageResults: PageData[] = [];

  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.shift()!;
    const normalized = url.replace(/\/$/, "") || siteUrl;
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    const scraped = await scrapePage(normalized);
    if (!scraped) continue;

    // Discover more internal links from the already-fetched HTML
    const newLinks = discoverInternalLinks(scraped._html, siteUrl.replace(/\/$/, ""));
    for (const link of newLinks) {
      if (!visited.has(link.replace(/\/$/, ""))) {
        toVisit.push(link);
      }
    }

    // Strip _html before storing in results
    const { _html: _, ...pageData } = scraped;
    pageResults.push(pageData);
  }

  if (pageResults.length === 0) {
    return NextResponse.json({
      error: "Could not scrape any pages from " + siteUrl + ". The site may be blocking requests or is unreachable.",
    });
  }

  // Check robots.txt and sitemap.xml
  let hasRobotsTxt = false;
  let hasSitemap = false;
  try {
    const robotsRes = await fetch(`${siteUrl.replace(/\/$/, "")}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
    });
    hasRobotsTxt = robotsRes.ok && (await robotsRes.text()).length > 10;
  } catch { /* ignore */ }
  try {
    const sitemapRes = await fetch(`${siteUrl.replace(/\/$/, "")}/sitemap.xml`, {
      signal: AbortSignal.timeout(5000),
    });
    hasSitemap = sitemapRes.ok && (await sitemapRes.text()).includes("<url");
  } catch { /* ignore */ }

  // Step 2: Build a summary for AI analysis
  const pageSummaries = pageResults.map((p) => ({
    url: p.url,
    title: p.title,
    metaDescription: p.metaDescription,
    h1Count: p.h1.length,
    h1: p.h1.slice(0, 3),
    h2Count: p.h2.length,
    h2: p.h2.slice(0, 5),
    wordCount: p.wordCount,
    imagesTotal: p.images.length,
    imagesMissingAlt: p.images.filter((i) => !i.alt).length,
    internalLinks: p.links.filter((l) => !l.isExternal).length,
    externalLinks: p.links.filter((l) => l.isExternal).length,
    hasCanonical: p.hasCanonical,
    hasOgTags: !!(p.ogTitle && p.ogDescription),
    hasTwitterCard: !!p.twitterCard,
    hasStructuredData: p.structuredData.length > 0,
    loadTimeMs: p.loadTimeMs,
    htmlSizeKb: Math.round(p.htmlSize / 1024),
  }));

  // Step 3: AI-powered SEO analysis
  const systemPrompt = `You are an expert SEO analyst specializing in both traditional SEO and AI SEO (optimizing content for AI search engines like Perplexity, ChatGPT search, and Google AI Overviews).

Analyze the website data provided and generate actionable SEO recommendations.

Return your response as a JSON object with this exact structure:
{
  "summary": "2-3 sentence overall SEO health assessment",
  "score": 0-100,
  "recommendations": [
    {
      "category": "meta" | "content" | "technical" | "performance" | "backlinks" | "structure" | "ai_seo",
      "title": "Short actionable title",
      "description": "Detailed explanation of the issue and how to fix it",
      "impact": "low" | "medium" | "high" | "critical",
      "pageUrl": "specific page URL or null if site-wide"
    }
  ]
}

Categories:
- meta: Title tags, meta descriptions, OG tags, canonical tags
- content: Word count, heading structure, keyword optimization, content quality
- technical: Robots meta, sitemap, structured data, canonical issues
- performance: Page load time, HTML size, resource optimization
- backlinks: Internal linking, external link strategy
- structure: URL structure, navigation, site architecture
- ai_seo: Optimizations for AI search engines (structured answers, entity clarity, FAQ schema, conversational content)

Focus on practical, high-impact recommendations. Include at least 3-5 AI SEO specific recommendations.
Return ONLY valid JSON, no markdown code blocks.`;

  const userMessage = `Analyze this website for SEO issues and opportunities:

Site: ${siteUrl}
Pages scraped: ${pageResults.length}
Has robots.txt: ${hasRobotsTxt}
Has sitemap.xml: ${hasSitemap}

Page data:
${JSON.stringify(pageSummaries, null, 2)}

Provide comprehensive SEO and AI SEO recommendations.`;

  let aiAnalysis: {
    summary: string;
    score: number;
    recommendations: Array<{
      category: string;
      title: string;
      description: string;
      impact: string;
      pageUrl?: string | null;
    }>;
  };

  try {
    const raw = await generate(systemPrompt, userMessage, 4096);
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    aiAnalysis = JSON.parse(cleaned);
  } catch (e) {
    return NextResponse.json({
      error: "AI analysis failed: " + (e instanceof Error ? e.message : String(e)),
      pagesScraped: pageResults.length,
    });
  }

  // Step 4: Save recommendations to DB (skip duplicates by title)
  const existing = await db.seoRecommendation.findMany({
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((r) => r.title));

  let newCount = 0;
  for (const rec of aiAnalysis.recommendations) {
    if (existingTitles.has(rec.title)) continue;

    await db.seoRecommendation.create({
      data: {
        category: rec.category,
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        status: "suggested",
        pageUrl: rec.pageUrl || null,
      },
    });
    newCount++;
  }

  // Save scan record
  await db.seoScan.create({
    data: {
      url: siteUrl,
      pagesScraped: pageResults.length,
      recommendations: newCount,
      summary: aiAnalysis.summary,
      rawData: JSON.stringify(pageSummaries),
    },
  });

  return NextResponse.json({
    ok: true,
    pagesScraped: pageResults.length,
    score: aiAnalysis.score,
    summary: aiAnalysis.summary,
    newRecommendations: newCount,
    totalRecommendations: aiAnalysis.recommendations.length,
  });
}
