import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const partners = await db.partner.findMany({
    where,
    include: { notes: { orderBy: { createdAt: "desc" }, take: 3 } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ partners });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const partner = await db.partner.create({
    data: {
      name: body.name,
      platform: body.platform,
      profileUrl: body.profileUrl,
      followers: body.followers || 0,
      category: body.category,
      status: body.status || "identified",
      dealTerms: body.dealTerms,
      dealDetails: body.dealDetails,
      email: body.email,
    },
  });

  await db.activityLog.create({
    data: {
      type: "partner_outreach",
      channel: "partnerships",
      details: JSON.stringify({ partnerId: partner.id, name: partner.name }),
    },
  });

  return NextResponse.json(partner, { status: 201 });
}
