import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agents/[slug]/memory — list all memory keys
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const entries = await db.agentMemory.findMany({
    where: { agentId: agent.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ entries, total: entries.length });
}
