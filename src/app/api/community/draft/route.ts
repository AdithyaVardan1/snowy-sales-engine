import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDraftResponse } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const { postId } = await request.json();

  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const post = await db.communityPost.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const draft = await generateDraftResponse({
    title: post.title,
    body: post.body,
    source: post.source,
    url: post.url,
  });

  await db.communityPost.update({
    where: { id: postId },
    data: { draftResponse: draft, status: "draft_ready" },
  });

  return NextResponse.json({ draft });
}
