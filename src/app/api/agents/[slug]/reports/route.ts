import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agents/[slug]/reports — list reports
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const where: Record<string, unknown> = { agentId: agent.id };
  if (type) where.type = type;

  const [reports, total] = await Promise.all([
    db.agentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        createdAt: true,
        data: true,
      },
    }),
    db.agentReport.count({ where }),
  ]);

  return NextResponse.json({ reports, total, limit, offset });
}
