import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { id } = params;

  const existing = await db.contentEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wasPublished = existing.status === "published";
  const isNowPublished = body.status === "published";

  const entry = await db.contentEntry.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      url: body.url ?? existing.url,
      platform: body.platform ?? existing.platform,
      channel: body.channel ?? existing.channel,
      contentType: body.contentType ?? existing.contentType,
      status: body.status ?? existing.status,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : existing.scheduledFor,
      publishedAt: isNowPublished && !wasPublished ? new Date() : existing.publishedAt,
      author: body.author ?? existing.author,
      likes: body.likes ?? existing.likes,
      replies: body.replies ?? existing.replies,
      shares: body.shares ?? existing.shares,
      clicks: body.clicks ?? existing.clicks,
      notes: body.notes ?? existing.notes,
    },
  });

  if (isNowPublished && !wasPublished) {
    await db.activityLog.create({
      data: {
        type: "content_published",
        channel: entry.channel,
        author: entry.author,
        details: JSON.stringify({ contentId: entry.id, platform: entry.platform }),
      },
    });
  }

  return NextResponse.json(entry);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.contentEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
