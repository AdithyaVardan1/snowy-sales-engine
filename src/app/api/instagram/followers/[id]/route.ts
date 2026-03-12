import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isNew } = body;

    const follower = await db.instagramFollower.findUnique({ where: { id } });
    if (!follower) {
      return NextResponse.json({ error: "Follower not found" }, { status: 404 });
    }

    const updated = await db.instagramFollower.update({
      where: { id },
      data: {
        ...(isNew !== undefined && { isNew }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update follower" },
      { status: 500 }
    );
  }
}
