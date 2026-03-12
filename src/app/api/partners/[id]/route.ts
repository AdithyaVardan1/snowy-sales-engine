import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const partner = await db.partner.findUnique({
    where: { id: params.id },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  });

  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(partner);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { id } = params;

  const existing = await db.partner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wasOnboarded = existing.status === "onboarded" || existing.status === "active";
  const isNowOnboarded = body.status === "onboarded" || body.status === "active";

  const partner = await db.partner.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      platform: body.platform ?? existing.platform,
      profileUrl: body.profileUrl ?? existing.profileUrl,
      followers: body.followers ?? existing.followers,
      category: body.category ?? existing.category,
      status: body.status ?? existing.status,
      dealTerms: body.dealTerms ?? existing.dealTerms,
      dealDetails: body.dealDetails ?? existing.dealDetails,
      email: body.email ?? existing.email,
      contactedAt:
        body.status === "contacted" && !existing.contactedAt
          ? new Date()
          : existing.contactedAt,
      onboardedAt:
        isNowOnboarded && !wasOnboarded ? new Date() : existing.onboardedAt,
    },
  });

  if (isNowOnboarded && !wasOnboarded) {
    await db.activityLog.create({
      data: {
        type: "partner_onboarded",
        channel: "partnerships",
        details: JSON.stringify({ partnerId: partner.id, name: partner.name }),
      },
    });
  }

  return NextResponse.json(partner);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.partner.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
