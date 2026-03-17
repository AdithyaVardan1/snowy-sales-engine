import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (status) where.status = status;

  const posts = await db.socialPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const post = await db.socialPost.create({
    data: {
      platform: body.platform,
      content: body.content,
      threadParts: body.threadParts ? JSON.stringify(body.threadParts) : null,
      status: body.status || "draft",
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      socialAccountId: body.socialAccountId || null,
    },
  });

  return NextResponse.json(post);
}
