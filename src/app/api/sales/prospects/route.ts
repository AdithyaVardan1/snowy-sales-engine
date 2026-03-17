import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sales/prospects — list prospects with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const prospects = await db.salesProspect.findMany({
    where,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, stage: true, sentiment: true, lastMessageAt: true, isActive: true },
      },
    },
  });

  return NextResponse.json({ prospects });
}

// POST /api/sales/prospects — add a prospect manually or from search
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.username || !body.platform) {
    return NextResponse.json(
      { error: "username and platform are required" },
      { status: 400 }
    );
  }

  const prospect = await db.salesProspect.upsert({
    where: {
      platform_username: {
        platform: body.platform,
        username: body.username,
      },
    },
    create: {
      platform: body.platform,
      username: body.username,
      displayName: body.displayName || null,
      profileUrl: body.profileUrl || null,
      bio: body.bio || null,
      followers: body.followers || 0,
      source: body.source || "manual",
      sourceDetails: body.sourceDetails ? JSON.stringify(body.sourceDetails) : null,
      score: body.score || 0,
      tags: body.tags || null,
      socialAccountId: body.socialAccountId || null,
    },
    update: {
      ...(body.displayName && { displayName: body.displayName }),
      ...(body.bio && { bio: body.bio }),
      ...(body.followers && { followers: body.followers }),
      ...(body.score !== undefined && { score: body.score }),
      ...(body.tags && { tags: body.tags }),
    },
  });

  return NextResponse.json(prospect);
}

// PATCH /api/sales/prospects — update prospect status/score/tags
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const prospect = await db.salesProspect.update({
    where: { id: body.id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.score !== undefined && { score: body.score }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.socialAccountId !== undefined && { socialAccountId: body.socialAccountId }),
    },
  });

  return NextResponse.json(prospect);
}

// DELETE /api/sales/prospects?id=xxx
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await db.salesProspect.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }
}
