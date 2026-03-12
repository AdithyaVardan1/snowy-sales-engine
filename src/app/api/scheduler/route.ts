import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const jobs = await db.cronJob.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const job = await db.cronJob.create({
    data: {
      name: body.name,
      type: body.type,
      schedule: body.schedule,
      enabled: body.enabled ?? true,
      config: body.config ? JSON.stringify(body.config) : null,
    },
  });

  return NextResponse.json(job);
}
