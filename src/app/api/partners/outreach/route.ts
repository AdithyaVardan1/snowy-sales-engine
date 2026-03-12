import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generate } from "@/lib/ai";

const SNOWY_CONTEXT = `Snowy AI by Snowball Labs — cloud-hosted OpenClaw platform.
- Deploy AI agents without infrastructure headaches
- BYOK (Bring Your Own Keys), 1-click integrations
- Starter: $12.5/mo, Pro: $39.5/mo, Enterprise: $79.5/mo
- Website: agent.snowballlabs.org`;

function buildOutreachPrompt(platform: string): string {
  if (platform === "twitter") {
    return `You are a BD representative for Snowy AI. Write a short, personalized Twitter DM to reach out to a potential partner.

Rules:
- Under 280 characters
- Casual but professional — founder-to-founder tone
- Reference something specific about them (their content, expertise, audience)
- Brief value prop — what's in it for them
- Soft CTA (not pushy)
- NO hashtags, NO emojis
- Write ONLY the message, nothing else

Product context:
${SNOWY_CONTEXT}`;
  }

  return `You are a BD representative for Snowy AI. Write a personalized LinkedIn outreach message to a potential partner.

Rules:
- Under 500 characters
- Professional but warm — peer-to-peer tone
- Open with something specific about their work
- Explain why you're reaching out (1 sentence)
- Brief value prop (1 sentence)
- Clear but soft CTA
- NO hashtags
- Write ONLY the message, nothing else

Product context:
${SNOWY_CONTEXT}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Single partner outreach
  if (body.partnerId) {
    const partner = await db.partner.findUnique({
      where: { id: body.partnerId },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 3 } },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const platform = body.platform || partner.platform;
    const context = body.context || "";

    const partnerInfo = `Name: ${partner.name}
Platform: ${partner.platform}
Category: ${partner.category}
Profile: ${partner.profileUrl || "N/A"}
Followers: ${partner.followers}
Deal terms: ${partner.dealTerms || "None yet"}
${partner.notes.length > 0 ? `Recent notes: ${partner.notes.map((n) => n.content).join("; ")}` : ""}
${context ? `Additional context: ${context}` : ""}`;

    try {
      const message = await generate(buildOutreachPrompt(platform), partnerInfo, 512);
      return NextResponse.json({ message: message.trim(), partnerId: partner.id });
    } catch (e: any) {
      return NextResponse.json({ error: `AI generation failed: ${e.message}` }, { status: 500 });
    }
  }

  // Batch outreach for multiple prospects (from discover flow)
  if (body.prospects && Array.isArray(body.prospects)) {
    const platform = body.platform || "twitter";
    const results: Array<{ name: string; handle: string; message: string }> = [];

    for (const prospect of body.prospects.slice(0, 10)) {
      try {
        const prospectInfo = `Name: ${prospect.name}
Handle: ${prospect.handle || prospect.name}
Platform: ${platform}
Recent post: ${prospect.recentPost || "N/A"}
Bio: ${prospect.bio || "N/A"}`;

        const message = await generate(buildOutreachPrompt(platform), prospectInfo, 512);
        results.push({
          name: prospect.name,
          handle: prospect.handle || prospect.name,
          message: message.trim(),
        });
      } catch (e) {
        results.push({
          name: prospect.name,
          handle: prospect.handle || prospect.name,
          message: `[Generation failed: ${e}]`,
        });
      }
    }

    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: "partnerId or prospects[] required" }, { status: 400 });
}
