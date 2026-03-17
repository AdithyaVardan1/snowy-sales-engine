import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sales/sessions — list sessions (optionally by prospect)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prospectId = searchParams.get("prospectId");
  const sessionId = searchParams.get("id");
  const activeOnly = searchParams.get("active") !== "false";

  // Single session with full messages
  if (sessionId) {
    const session = await db.salesSession.findUnique({
      where: { id: sessionId },
      include: {
        prospect: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  }

  const where: Record<string, unknown> = {};
  if (prospectId) where.prospectId = prospectId;
  if (activeOnly) where.isActive = true;

  const sessions = await db.salesSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      prospect: {
        select: { id: true, username: true, displayName: true, platform: true, status: true, score: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({ sessions });
}

// POST /api/sales/sessions — create a new session for a prospect
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.prospectId) {
    return NextResponse.json({ error: "prospectId is required" }, { status: 400 });
  }

  const session = await db.salesSession.create({
    data: {
      prospectId: body.prospectId,
      stage: body.stage || "cold_outreach",
    },
  });

  return NextResponse.json(session);
}

// PATCH /api/sales/sessions — update session stage, pause, etc.
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const session = await db.salesSession.update({
    where: { id: body.id },
    data: {
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.isPaused !== undefined && { isPaused: body.isPaused }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.sentiment !== undefined && { sentiment: body.sentiment }),
      ...(body.nextAction !== undefined && { nextAction: body.nextAction }),
    },
  });

  return NextResponse.json(session);
}
