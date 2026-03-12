import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "30d";

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [
    totalResponses,
    contentPublished,
    activePartnerships,
    totalPosts,
    activities,
  ] = await Promise.all([
    db.communityPost.count({
      where: { status: "responded", respondedAt: { gte: since } },
    }),
    db.contentEntry.count({
      where: { status: "published", publishedAt: { gte: since } },
    }),
    db.partner.count({
      where: { status: { in: ["onboarded", "active"] } },
    }),
    db.communityPost.count({
      where: { createdAt: { gte: since } },
    }),
    db.activityLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const responseRate = totalPosts > 0 ? totalResponses / totalPosts : 0;

  // Channel breakdown
  const channelMap: Record<string, number> = {};
  activities.forEach((a) => {
    channelMap[a.channel] = (channelMap[a.channel] || 0) + 1;
  });
  const channelBreakdown = Object.entries(channelMap).map(([channel, count]) => ({
    channel,
    count,
  }));

  // Weekly trends
  const weekMap: Record<string, { responses: number; content: number; partners: number }> = {};
  activities.forEach((a) => {
    const weekStart = getWeekStart(a.createdAt);
    if (!weekMap[weekStart]) {
      weekMap[weekStart] = { responses: 0, content: 0, partners: 0 };
    }
    if (a.type === "community_response") weekMap[weekStart].responses++;
    if (a.type === "content_published") weekMap[weekStart].content++;
    if (a.type.startsWith("partner_")) weekMap[weekStart].partners++;
  });
  const weeklyTrend = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, data]) => ({ week, ...data }));

  return NextResponse.json({
    metrics: {
      totalResponses,
      contentPublished,
      activePartnerships,
      responseRate,
    },
    channelBreakdown,
    weeklyTrend,
  });
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}
