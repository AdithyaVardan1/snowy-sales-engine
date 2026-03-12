import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { postId, finalResponse, respondedBy } = await request.json();

  if (!postId || !finalResponse) {
    return NextResponse.json(
      { error: "postId and finalResponse required" },
      { status: 400 }
    );
  }

  const post = await db.communityPost.update({
    where: { id: postId },
    data: {
      status: "responded",
      finalResponse,
      respondedBy: respondedBy || "team",
      respondedAt: new Date(),
    },
  });

  // Log the activity
  await db.activityLog.create({
    data: {
      type: "community_response",
      channel: "community",
      author: respondedBy || "team",
      details: JSON.stringify({ postId, source: post.source, title: post.title }),
    },
  });

  return NextResponse.json(post);
}
