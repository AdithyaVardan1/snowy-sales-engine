import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agents/[slug]/reports/[id] — get single report
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;

  const report = await db.agentReport.findUnique({
    where: { id },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
