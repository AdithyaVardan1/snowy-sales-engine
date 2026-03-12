import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const notes = await db.partnerNote.findMany({
    where: { partnerId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const note = await db.partnerNote.create({
    data: {
      partnerId: params.id,
      content: body.content,
      author: body.author || "team",
    },
  });

  return NextResponse.json(note, { status: 201 });
}
