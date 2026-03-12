import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const post = await db.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(post);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const body = await request.json();
  const existing = await db.blogPost.findUnique({ where: { slug: params.slug } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { ...body };
  if (body.status === "published" && existing.status !== "published") {
    data.publishedAt = new Date();
    await db.activityLog.create({
      data: {
        type: "content_published",
        channel: "social_media",
        details: JSON.stringify({ blogPostId: existing.id, title: body.title || existing.title }),
      },
    });
  }
  if (body.scheduledFor) data.scheduledFor = new Date(body.scheduledFor);

  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;

  const post = await db.blogPost.update({ where: { slug: params.slug }, data });
  return NextResponse.json(post);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  await db.blogPost.delete({ where: { slug: params.slug } });
  return NextResponse.json({ success: true });
}
