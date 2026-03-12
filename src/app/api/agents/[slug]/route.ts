import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agents/[slug] — get agent detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const agent = await db.agent.findUnique({
    where: { slug },
    include: {
      _count: { select: { observations: true, reports: true, memory: true } },
      reports: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

// PUT /api/agents/[slug] — update agent config/schedule/enabled
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.schedule !== undefined) updateData.schedule = body.schedule;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.config !== undefined) updateData.config = typeof body.config === "string" ? body.config : JSON.stringify(body.config);
  if (body.description !== undefined) updateData.description = body.description;

  // If disabling, also set status to disabled
  if (body.enabled === false) {
    updateData.status = "disabled";
  } else if (body.enabled === true && agent.status === "disabled") {
    updateData.status = "idle";
  }

  const updated = await db.agent.update({
    where: { slug },
    data: updateData,
  });

  return NextResponse.json(updated);
}
