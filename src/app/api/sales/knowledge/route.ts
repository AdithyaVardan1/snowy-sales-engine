import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sales/knowledge — list all knowledge entries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("active") !== "false";

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (activeOnly) where.isActive = true;

  const entries = await db.knowledgeEntry.findMany({
    where,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ entries });
}

// POST /api/sales/knowledge — create a new knowledge entry
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.title || !body.content || !body.category) {
    return NextResponse.json(
      { error: "title, content, and category are required" },
      { status: 400 }
    );
  }

  const entry = await db.knowledgeEntry.create({
    data: {
      title: body.title,
      content: body.content,
      category: body.category,
      priority: body.priority ?? 0,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json(entry);
}

// PATCH /api/sales/knowledge — update an existing entry
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const entry = await db.knowledgeEntry.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(entry);
}

// DELETE /api/sales/knowledge?id=xxx
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await db.knowledgeEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
}
