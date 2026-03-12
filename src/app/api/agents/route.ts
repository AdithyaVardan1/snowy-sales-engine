import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGENT_SEEDS } from "@/lib/agents/seeds";

// GET /api/agents — list all agents with counts
export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { observations: true, reports: true } },
    },
  });

  return NextResponse.json(agents);
}

// POST /api/agents — seed all predefined agents
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "seed") {
    const created: string[] = [];
    for (const seed of AGENT_SEEDS) {
      const existing = await db.agent.findUnique({ where: { slug: seed.slug } });
      if (!existing) {
        await db.agent.create({
          data: {
            slug: seed.slug,
            name: seed.name,
            type: seed.type,
            schedule: seed.schedule,
            description: seed.description,
            enabled: false,
            status: "idle",
          },
        });
        created.push(seed.slug);
      }
    }
    return NextResponse.json({ ok: true, created, total: AGENT_SEEDS.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
