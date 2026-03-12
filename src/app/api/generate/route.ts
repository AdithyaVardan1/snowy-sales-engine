import { NextRequest, NextResponse } from "next/server";
import { generateContentForPlatform } from "@/lib/blog-generator";

export async function POST(request: NextRequest) {
  const { topic, platform } = await request.json();

  if (!topic || !platform) {
    return NextResponse.json({ error: "topic and platform required" }, { status: 400 });
  }

  if (!["twitter", "linkedin", "reddit"].includes(platform)) {
    return NextResponse.json({ error: "Platform must be twitter, linkedin, or reddit" }, { status: 400 });
  }

  try {
    const content = await generateContentForPlatform(topic, platform);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
