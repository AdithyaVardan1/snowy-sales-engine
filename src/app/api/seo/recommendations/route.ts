import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/seo/recommendations
 * Query params: ?status=suggested&category=meta
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const recommendations = await db.seoRecommendation.findMany({
    where,
    orderBy: [{ status: "asc" }, { impact: "desc" }, { createdAt: "desc" }],
  });

  // Also get scan history
  const scans = await db.seoScan.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Stats
  const stats = {
    total: recommendations.length,
    suggested: recommendations.filter((r) => r.status === "suggested").length,
    inProgress: recommendations.filter((r) => r.status === "in_progress").length,
    done: recommendations.filter((r) => r.status === "done").length,
    dismissed: recommendations.filter((r) => r.status === "dismissed").length,
    critical: recommendations.filter((r) => r.impact === "critical").length,
    high: recommendations.filter((r) => r.impact === "high").length,
  };

  return NextResponse.json({ recommendations, scans, stats });
}

/**
 * PATCH /api/seo/recommendations
 * Body: { id: string, status: string }
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const data: Record<string, unknown> = { status };
  if (status === "done") {
    data.completedAt = new Date();
  }

  const updated = await db.seoRecommendation.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/seo/recommendations
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.seoRecommendation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
