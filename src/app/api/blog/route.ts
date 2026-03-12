import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [posts, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.blogPost.count({ where }),
  ]);

  return NextResponse.json({ posts, total });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const post = await db.blogPost.create({
    data: {
      title: body.title,
      slug: body.slug,
      content: body.content,
      metaDescription: body.metaDescription || null,
      keywords: body.keywords || null,
      status: body.status || "draft",
      generatedFrom: body.generatedFrom || null,
      publishedAt: body.status === "published" ? new Date() : null,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
    },
  });

  if (body.status === "published") {
    await db.activityLog.create({
      data: {
        type: "content_published",
        channel: "social_media",
        details: JSON.stringify({ blogPostId: post.id, title: post.title }),
      },
    });
  }

  return NextResponse.json(post);
}
