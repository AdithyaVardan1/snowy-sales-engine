import { NextRequest, NextResponse } from "next/server";
import { generateBlogPost } from "@/lib/blog-generator";

export async function POST(request: NextRequest) {
  const { topic } = await request.json();

  if (!topic) {
    return NextResponse.json({ error: "Topic required" }, { status: 400 });
  }

  try {
    const result = await generateBlogPost(topic);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
