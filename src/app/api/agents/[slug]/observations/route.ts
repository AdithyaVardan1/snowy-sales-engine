import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agents/[slug]/observations — paginated observations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const subject = url.searchParams.get("subject");
  const importance = url.searchParams.get("importance");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const where: Record<string, unknown> = { agentId: agent.id };
  if (category) where.category = category;
  if (subject) where.subject = subject;
  if (importance) where.importance = importance;

  const [observations, total] = await Promise.all([
    db.agentObservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.agentObservation.count({ where }),
  ]);

  return NextResponse.json({ observations, total, limit, offset });
}
