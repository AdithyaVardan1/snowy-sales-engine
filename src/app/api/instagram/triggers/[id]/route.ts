import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Props = { params: { id: string } };

// GET — Single trigger with recent logs
export async function GET(_request: NextRequest, { params }: Props) {
  const trigger = await db.instagramCommentTrigger.findUnique({
    where: { id: params.id },
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { logs: true } },
    },
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  return NextResponse.json(trigger);
}

// PUT — Update trigger
export async function PUT(request: NextRequest, { params }: Props) {
  const body = await request.json();

  const existing = await db.instagramCommentTrigger.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  // Validate messagePayload if provided
  if (body.messagePayload) {
    try {
      JSON.parse(body.messagePayload);
    } catch {
      return NextResponse.json(
        { error: "messagePayload must be valid JSON" },
        { status: 400 }
      );
    }
  }

  const trigger = await db.instagramCommentTrigger.update({
    where: { id: params.id },
    data: {
      keyword: body.keyword?.trim() ?? existing.keyword,
      matchType: body.matchType ?? existing.matchType,
      postFilter: body.postFilter !== undefined ? body.postFilter || null : existing.postFilter,
      messageType: body.messageType ?? existing.messageType,
      messagePayload: body.messagePayload ?? existing.messagePayload,
      replyToComment: body.replyToComment ?? existing.replyToComment,
      commentReplyText: body.commentReplyText !== undefined ? body.commentReplyText || null : existing.commentReplyText,
      isActive: body.isActive ?? existing.isActive,
    },
  });

  return NextResponse.json(trigger);
}

// DELETE — Remove trigger
export async function DELETE(_request: NextRequest, { params }: Props) {
  const existing = await db.instagramCommentTrigger.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  await db.instagramCommentTrigger.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
