import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channel = searchParams.get("channel");
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: any = {};
  if (channel) where.channel = channel;
  if (platform) where.platform = platform;
  if (status) where.status = status;

  const [entries, total] = await Promise.all([
    db.contentEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.contentEntry.count({ where }),
  ]);

  return NextResponse.json({ entries, total });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const entry = await db.contentEntry.create({
    data: {
      title: body.title,
      description: body.description,
      url: body.url,
      platform: body.platform,
      channel: body.channel,
      contentType: body.contentType,
      status: body.status || "draft",
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      publishedAt: body.status === "published" ? new Date() : null,
      author: body.author || "team",
      notes: body.notes,
    },
  });

  if (body.status === "published") {
    await db.activityLog.create({
      data: {
        type: "content_published",
        channel: body.channel,
        author: body.author || "team",
        details: JSON.stringify({ contentId: entry.id, platform: body.platform }),
      },
    });
  }

  return NextResponse.json(entry, { status: 201 });
}
