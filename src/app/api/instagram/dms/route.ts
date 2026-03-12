import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendInstagramDM } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status"); // "sent" | "failed" | null (all)

    const where: any = {};
    if (status) where.status = status;

    const [dms, total] = await Promise.all([
      db.instagramDM.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.instagramDM.count({ where }),
    ]);

    return NextResponse.json({ dms, total });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch DMs" },
      { status: 500 }
    );
  }
}

// POST: Send a manual DM
export async function POST(request: NextRequest) {
  try {
    const { igUserId, username, content, templateId } = await request.json();

    if (!igUserId || !username) {
      return NextResponse.json(
        { error: "igUserId and username required" },
        { status: 400 }
      );
    }

    let messageContent = content;

    // If templateId provided, load template content
    if (templateId && !content) {
      const template = await db.instagramTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      messageContent = template.content.replace(/\{\{username\}\}/g, username);
    }

    if (!messageContent) {
      return NextResponse.json(
        { error: "content or templateId required" },
        { status: 400 }
      );
    }

    // Send DM via Instagram
    const result = await sendInstagramDM(igUserId, messageContent);

    // Record in DB
    const dm = await db.instagramDM.create({
      data: {
        igUserId,
        username,
        templateId: templateId || null,
        content: messageContent,
        status: "sent",
        threadId: result.threadId,
        messageId: result.messageId,
      },
    });

    // Update follower record if exists
    await db.instagramFollower
      .update({
        where: { igUserId },
        data: { dmSent: true, dmSentAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json(dm);
  } catch (error: any) {
    // Record failed DM
    const body = await request.json().catch(() => ({}));
    if (body.igUserId) {
      await db.instagramDM.create({
        data: {
          igUserId: body.igUserId,
          username: body.username || "unknown",
          content: body.content || "",
          status: "failed",
          error: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to send DM" },
      { status: 500 }
    );
  }
}
