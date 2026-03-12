import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: any = {};
  if (source) where.source = source;
  if (status) where.status = status;

  const [posts, total] = await Promise.all([
    db.communityPost.findMany({
      where,
      orderBy: { fetchedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.communityPost.count({ where }),
  ]);

  return NextResponse.json({ posts, total, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const post = await db.communityPost.create({
    data: {
      externalId: `manual_${Date.now()}`,
      source: body.source || "manual",
      title: body.title,
      body: body.body || "",
      author: body.author || "unknown",
      url: body.url || "",
      subreddit: body.subreddit,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
