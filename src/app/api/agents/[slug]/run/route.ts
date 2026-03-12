import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentRunner, registerAgent } from "@/lib/agents/registry";
import { CompetitiveIntelRunner } from "@/lib/agents/competitive-intel";
import { CommunityMonitorRunner } from "@/lib/agents/community";
import { SocialMediaRunner } from "@/lib/agents/social-media";
import { BusinessDevRunner } from "@/lib/agents/business-dev";
import { DevRelRunner } from "@/lib/agents/devrel";
import { AnalyticsRunner } from "@/lib/agents/analytics";
import { BrandGuardianRunner } from "@/lib/agents/brand";
import { EnterpriseOutreachRunner } from "@/lib/agents/enterprise";
import { NewsletterCompilerRunner } from "@/lib/agents/newsletter";

// Ensure runners are registered
registerAgent(new CompetitiveIntelRunner());
registerAgent(new CommunityMonitorRunner());
registerAgent(new SocialMediaRunner());
registerAgent(new BusinessDevRunner());
registerAgent(new DevRelRunner());
registerAgent(new AnalyticsRunner());
registerAgent(new BrandGuardianRunner());
registerAgent(new EnterpriseOutreachRunner());
registerAgent(new NewsletterCompilerRunner());

// POST /api/agents/[slug]/run — trigger a manual run
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const agent = await db.agent.findUnique({ where: { slug } });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.status === "running") {
    return NextResponse.json({ error: "Agent is already running" }, { status: 409 });
  }

  const runner = getAgentRunner(agent.type);
  if (!runner) {
    return NextResponse.json(
      { error: `No runner implemented for agent type: ${agent.type}. Coming soon!` },
      { status: 501 }
    );
  }

  // Mark as running
  await db.agent.update({
    where: { slug },
    data: { status: "running" },
  });

  const start = Date.now();
  try {
    const result = await runner.execute(agent);
    await db.agent.update({
      where: { slug },
      data: {
        status: "idle",
        lastRunAt: new Date(),
        lastRunDurationMs: Date.now() - start,
        lastError: null,
        runCount: { increment: 1 },
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await db.agent.update({
      where: { slug },
      data: {
        status: "error",
        lastRunAt: new Date(),
        lastRunDurationMs: Date.now() - start,
        lastError: errorMsg,
      },
    });
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
