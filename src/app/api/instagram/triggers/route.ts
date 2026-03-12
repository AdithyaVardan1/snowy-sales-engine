import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — List all triggers with stats
export async function GET() {
  const triggers = await db.instagramCommentTrigger.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { logs: true } },
    },
  });

  // Get today's comment count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const commentsToday = await db.instagramCommentLog.count({
    where: { createdAt: { gte: todayStart } },
  });

  const dmsSentToday = await db.instagramCommentLog.count({
    where: { dmSent: true, dmSentAt: { gte: todayStart } },
  });

  return NextResponse.json({ triggers, commentsToday, dmsSentToday });
}

// POST — Create a new trigger
export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    keyword,
    matchType = "contains",
    postFilter,
    messageType = "text",
    messagePayload,
    replyToComment = false,
    commentReplyText,
  } = body;

  if (!keyword || !messagePayload) {
    return NextResponse.json(
      { error: "keyword and messagePayload are required" },
      { status: 400 }
    );
  }

  // Validate messagePayload is valid JSON
  try {
    JSON.parse(messagePayload);
  } catch {
    return NextResponse.json(
      { error: "messagePayload must be valid JSON" },
      { status: 400 }
    );
  }

  const trigger = await db.instagramCommentTrigger.create({
    data: {
      keyword: keyword.trim(),
      matchType,
      postFilter: postFilter || null,
      messageType,
      messagePayload,
      replyToComment,
      commentReplyText: commentReplyText || null,
    },
  });

  return NextResponse.json(trigger, { status: 201 });
}
