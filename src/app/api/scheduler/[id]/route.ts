import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.schedule !== undefined) data.schedule = body.schedule;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.config !== undefined) data.config = JSON.stringify(body.config);

  const job = await db.cronJob.update({ where: { id: params.id }, data });
  return NextResponse.json(job);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.cronJob.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
