import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postTweet, postThread } from "@/lib/twitter";
import { postLinkedInUpdate } from "@/lib/linkedin";

export async function POST(request: NextRequest) {
  const { postId } = await request.json();

  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const socialPost = await db.socialPost.findUnique({ where: { id: postId } });
  if (!socialPost) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  try {
    let externalId = "";

    if (socialPost.platform === "twitter") {
      // Check if it's a thread
      if (socialPost.threadParts) {
        const parts = JSON.parse(socialPost.threadParts) as string[];
        const result = await postThread(parts);
        externalId = result.ids[0] || "";
      } else {
        const result = await postTweet(socialPost.content);
        externalId = result.id;
      }
    } else if (socialPost.platform === "linkedin") {
      const result = await postLinkedInUpdate(socialPost.content);
      externalId = result.id || "";
    } else {
      return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
    }

    // Update post status
    const updated = await db.socialPost.update({
      where: { id: postId },
      data: {
        status: "posted",
        postedAt: new Date(),
        externalId,
        error: null,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        type: "content_published",
        channel: "social_media",
        details: JSON.stringify({
          socialPostId: postId,
          platform: socialPost.platform,
          externalId,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Publishing failed";

    await db.socialPost.update({
      where: { id: postId },
      data: { status: "failed", error: message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
