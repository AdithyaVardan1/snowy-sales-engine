import { Agent } from "@prisma/client";
import { db } from "../../db";
import { generate } from "../../ai";
import { AgentRunner, AgentRunResult } from "../types";
import { getMemory, setMemory } from "../memory";

const BRAND_GUIDELINES = `Snowy AI Brand Voice Guidelines:
- Tone: Professional but approachable. Tech-savvy but not jargon-heavy.
- Personality: Confident, helpful, forward-thinking
- DO: Use clear language, show expertise, be direct, use data
- DON'T: Be overly casual, use excessive emojis, use hashtags, be salesy/pushy
- Product name: "Snowy AI" (not "SnowyAI" or "snowy ai")
- Company: "Snowball Labs" (not "Snowball Money")
- Website: agent.snowballlabs.org
- Key messaging: "Deploy AI agents without infrastructure headaches"
- Pricing must be accurate: Starter $12.5/mo, Pro $39.5/mo, Enterprise $79.5/mo`;

/**
 * Brand Guardian Agent
 *
 * Runs daily at 10am to:
 * 1. Audit recent social posts for brand consistency
 * 2. Check blog posts for voice/style compliance
 * 3. Monitor community responses for brand alignment
 * 4. Flag content that needs review
 * 5. Generate brand health report
 */
export class BrandGuardianRunner implements AgentRunner {
  slug = "brand";

  async execute(agent: Agent): Promise<AgentRunResult> {
    let observationsCreated = 0;
    let reportsCreated = 0;
    const errors: string[] = [];

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // ── 1. Audit recent social posts ──
    const recentSocialPosts = await db.socialPost.findMany({
      where: { status: "posted", postedAt: { gte: oneDayAgo } },
      select: { id: true, platform: true, content: true, postedAt: true },
      take: 20,
    });

    let socialAudit: Array<{ id: string; platform: string; score: number; issues: string[] }> = [];
    if (recentSocialPosts.length > 0) {
      try {
        const postsText = recentSocialPosts
          .map((p, i) => `Post ${i + 1} [${p.platform}]: ${p.content.slice(0, 300)}`)
          .join("\n\n");

        const raw = await generate(
          `You are a brand auditor. Review these social posts against the brand guidelines and score each.

Brand Guidelines:
${BRAND_GUIDELINES}

For each post, provide:
- id: post number (1, 2, etc.)
- score: 1-10 (10 = perfect brand alignment)
- issues: array of specific issues found (empty array if none)

Return JSON: { "audits": [{ "id": 1, "score": 8, "issues": ["used hashtag"] }] }
Return ONLY valid JSON, no markdown fences.`,
          postsText,
          1024
        );

        const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        socialAudit = (parsed.audits || []).map((a: any, i: number) => ({
          id: recentSocialPosts[i]?.id || `post-${i}`,
          platform: recentSocialPosts[i]?.platform || "unknown",
          score: a.score || 5,
          issues: a.issues || [],
        }));
      } catch (e) {
        errors.push(`Social audit: ${e}`);
      }
    }

    if (socialAudit.length > 0) {
      const avgScore = socialAudit.reduce((sum, a) => sum + a.score, 0) / socialAudit.length;
      const flagged = socialAudit.filter((a) => a.score < 7);

      await db.agentObservation.create({
        data: {
          agentId: agent.id,
          category: "social_audit",
          subject: "brand_scores",
          data: JSON.stringify({ averageScore: Math.round(avgScore * 10) / 10, totalAudited: socialAudit.length, flagged: flagged.length, details: socialAudit }),
          importance: flagged.length > 0 ? "high" : "normal",
        },
      });
      observationsCreated++;
    }

    // ── 2. Audit recent blog posts ──
    const recentBlogs = await db.blogPost.findMany({
      where: { status: "published", publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { id: true, title: true, content: true },
      take: 5,
    });

    let blogAudit: Array<{ title: string; score: number; issues: string[] }> = [];
    if (recentBlogs.length > 0) {
      try {
        const blogsText = recentBlogs
          .map((b) => `"${b.title}": ${b.content.slice(0, 500)}`)
          .join("\n\n");

        const raw = await generate(
          `You are a brand auditor. Review these blog posts against brand guidelines.

Brand Guidelines:
${BRAND_GUIDELINES}

For each blog, provide:
- title: the blog title
- score: 1-10 (brand alignment)
- issues: specific issues found

Return JSON: { "audits": [...] }
Return ONLY valid JSON, no markdown fences.`,
          blogsText,
          512
        );

        const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        blogAudit = parsed.audits || [];
      } catch (e) {
        errors.push(`Blog audit: ${e}`);
      }

      if (blogAudit.length > 0) {
        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "blog_audit",
            subject: "brand_scores",
            data: JSON.stringify({ audits: blogAudit }),
            importance: blogAudit.some((a) => a.score < 7) ? "high" : "normal",
          },
        });
        observationsCreated++;
      }
    }

    // ── 3. Check community draft responses ──
    const draftResponses = await db.communityPost.findMany({
      where: { draftResponse: { not: null }, updatedAt: { gte: oneDayAgo } },
      select: { id: true, title: true, draftResponse: true },
      take: 10,
    });

    if (draftResponses.length > 0) {
      try {
        const draftsText = draftResponses
          .map((d) => `Re: "${d.title}"\nDraft: ${(d.draftResponse || "").slice(0, 300)}`)
          .join("\n\n");

        const raw = await generate(
          `Review these community response drafts for brand voice compliance. Flag any that are too casual, off-brand, or contain inaccurate product info.

Brand Guidelines:
${BRAND_GUIDELINES}

Return JSON: { "flagged": [{ "title": "...", "issue": "..." }], "totalReviewed": N, "approved": N }
Return ONLY valid JSON.`,
          draftsText,
          512
        );

        const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        await db.agentObservation.create({
          data: {
            agentId: agent.id,
            category: "draft_audit",
            subject: "community_responses",
            data: JSON.stringify(parsed),
            importance: (parsed.flagged || []).length > 0 ? "high" : "normal",
          },
        });
        observationsCreated++;
      } catch (e) {
        errors.push(`Draft audit: ${e}`);
      }
    }

    // ── 4. Generate brand health report ──
    try {
      const allScores = [
        ...socialAudit.map((a) => a.score),
        ...blogAudit.map((a) => a.score),
      ];
      const overallScore = allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : 0;

      const prevScore = await getMemory<number>(agent.id, "prev_brand_score") ?? 0;
      await setMemory(agent.id, "prev_brand_score", overallScore);

      const reportInput = `Brand score: ${overallScore}/10 (prev: ${prevScore}/10)
Social posts audited: ${socialAudit.length}
Blog posts audited: ${blogAudit.length}
Drafts reviewed: ${draftResponses.length}
Social flagged: ${socialAudit.filter((a) => a.score < 7).length}
Blog flagged: ${blogAudit.filter((a) => a.score < 7).length}
Common issues: ${[...socialAudit.flatMap((a) => a.issues), ...blogAudit.flatMap((a) => a.issues)].slice(0, 10).join(", ") || "None"}`;

      const report = await generate(
        `You are a brand manager. Write a daily brand health report in markdown. Include: overall brand score, trend vs yesterday, flagged content, common issues, and recommendations. Keep under 300 words.`,
        reportInput,
        512
      );

      await db.agentReport.create({
        data: {
          agentId: agent.id,
          type: "daily_summary",
          title: `Brand Health — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          content: report,
          data: JSON.stringify({ overallScore, socialAudited: socialAudit.length, blogAudited: blogAudit.length }),
        },
      });
      reportsCreated++;
    } catch (e) {
      errors.push(`Report: ${e}`);
    }

    // Cleanup
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    await db.agentObservation.deleteMany({ where: { agentId: agent.id, createdAt: { lt: cutoff } } });

    return {
      observationsCreated,
      reportsCreated,
      summary: `Audited ${recentSocialPosts.length} social posts, ${recentBlogs.length} blogs, ${draftResponses.length} drafts. ${errors.length} errors.`,
    };
  }
}
