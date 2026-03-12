import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const templates = await db.instagramTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, content, isDefault } = await request.json();

    if (!name || !content) {
      return NextResponse.json(
        { error: "name and content required" },
        { status: 400 }
      );
    }

    // If setting as default, unset all others first
    if (isDefault) {
      await db.instagramTemplate.updateMany({
        data: { isDefault: false },
      });
    }

    const template = await db.instagramTemplate.create({
      data: {
        name,
        content,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json(template);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create template" },
      { status: 500 }
    );
  }
}
