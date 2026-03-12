import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTwitterDM } from "@/lib/twitter";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { partnerId, platform, message } = body;

  if (!partnerId || !message) {
    return NextResponse.json({ error: "partnerId and message are required" }, { status: 400 });
  }

  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const sendPlatform = platform || partner.platform;
  let externalId = "";

  // Send the outreach message
  if (sendPlatform === "twitter") {
    try {
      // Extract target handle from profileUrl or name
      let handle = "";
      if (partner.profileUrl) {
        const match = partner.profileUrl.match(/(?:x\.com|twitter\.com)\/([^/]+)/i);
        if (match) {
          handle = match[1];
        } else {
          handle = partner.name.replace('@', '');
        }
      } else {
        handle = partner.name.replace('@', '');
      }

      if (!handle) {
        return NextResponse.json({ error: "Could not determine Twitter handle for DM" }, { status: 400 });
      }

      const result = await sendTwitterDM(handle, message);
      externalId = result.dm_id;
    } catch (e: any) {
      return NextResponse.json({ error: `Twitter DM failed: ${e.message}` }, { status: 500 });
    }
  } else {
    // For LinkedIn and other platforms, we just log it (manual send)
    // Copy was already done on the frontend
  }

  // Update partner status to "contacted"
  const updateData: any = {
    status: "contacted",
  };
  if (!partner.contactedAt) {
    updateData.contactedAt = new Date();
  }
  await db.partner.update({ where: { id: partnerId }, data: updateData });

  // Log as a note
  await db.partnerNote.create({
    data: {
      partnerId,
      content: `[Outreach sent via ${sendPlatform}]\n${message}`,
      author: "system",
    },
  });

  // Activity log
  await db.activityLog.create({
    data: {
      type: "partner_outreach",
      channel: sendPlatform,
      details: JSON.stringify({
        partnerId,
        partnerName: partner.name,
        platform: sendPlatform,
        externalId,
        messagePreview: message.slice(0, 100),
      }),
    },
  });

  return NextResponse.json({
    success: true,
    externalId,
    status: "contacted",
  });
}
