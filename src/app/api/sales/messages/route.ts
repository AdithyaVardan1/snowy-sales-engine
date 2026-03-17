import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTwitterDM } from "@/lib/twitter";
import { sendInstagramDMByUsername } from "@/lib/instagram";
import { generateReply, buildKnowledgeContext } from "@/lib/sales-engine";

// POST /api/sales/messages — create a manual message or generate AI reply
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, content, action } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = await db.salesSession.findUnique({
    where: { id: sessionId },
    include: { prospect: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Action: generate AI reply without sending
  if (action === "generate") {
    try {
      const knowledgeContext = await buildKnowledgeContext();
      const reply = await generateReply(sessionId, session.stage, knowledgeContext, session.prospect);

      const message = await db.salesMessage.create({
        data: {
          sessionId,
          role: "outbound",
          content: reply,
          status: "draft",
        },
      });

      return NextResponse.json({ message, generated: true });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  // Action: send a specific pending/draft message immediately
  if (action === "send" && body.messageId) {
    const msg = await db.salesMessage.findUnique({
      where: { id: body.messageId },
      include: { session: { include: { prospect: true } } },
    });

    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    try {
      const prospect = msg.session.prospect;
      let externalId: string;

      if (prospect.platform === "instagram") {
        const igResult = await sendInstagramDMByUsername(
          prospect.username,
          msg.content,
          prospect.socialAccountId || undefined
        );
        externalId = igResult.messageId || igResult.threadId;
      } else {
        const dmResult = await sendTwitterDM(
          prospect.username,
          msg.content,
          prospect.socialAccountId || undefined
        );
        externalId = dmResult.dm_id;
      }

      await db.salesMessage.update({
        where: { id: msg.id },
        data: { status: "sent", externalId, sentAt: new Date() },
      });

      await db.salesProspect.update({
        where: { id: msg.session.prospectId },
        data: { lastContactedAt: new Date() },
      });

      await db.salesSession.update({
        where: { id: msg.sessionId },
        data: { lastMessageAt: new Date() },
      });

      return NextResponse.json({ ok: true, sent: true, externalId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      await db.salesMessage.update({
        where: { id: msg.id },
        data: { status: "failed", error },
      });
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  // Default: create a manual outbound message
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const message = await db.salesMessage.create({
    data: {
      sessionId,
      role: "outbound",
      content,
      status: body.status || "draft",
    },
  });

  return NextResponse.json({ message });
}

// PATCH /api/sales/messages — edit a draft message
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const message = await db.salesMessage.update({
    where: { id: body.id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json({ message });
}

// DELETE /api/sales/messages?id=xxx — delete a draft message
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Only allow deleting draft messages
  const msg = await db.salesMessage.findUnique({ where: { id } });
  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  if (msg.status !== "draft") {
    return NextResponse.json({ error: "Can only delete draft messages" }, { status: 400 });
  }

  await db.salesMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
