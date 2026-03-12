import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const data: Record<string, unknown> = { ...body };
  if (body.scheduledFor) data.scheduledFor = new Date(body.scheduledFor);
  if (body.threadParts) data.threadParts = JSON.stringify(body.threadParts);
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;

  const post = await db.socialPost.update({ where: { id: params.id }, data });
  return NextResponse.json(post);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.socialPost.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
