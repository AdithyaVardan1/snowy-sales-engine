import { NextRequest, NextResponse } from "next/server";
import { postTweet } from "@/lib/twitter";
import { generate, getAvailableProvider } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const { tweetId, tweetText, tweetAuthor, replyText, generateDraft } =
    await request.json();

  // Generate an AI draft reply
  if (generateDraft) {
    if (!getAvailableProvider()) {
      return NextResponse.json(
        { error: "No AI provider configured" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a helpful community member and AI/tech enthusiast who is a fan of Snowy AI by Snowball Labs (agent.snowballlabs.org), an AI-powered sales engine that automates GTM strategy, community monitoring, and outreach.

Rules:
- Be genuinely helpful. Address the specific problem the user is facing.
- Keep replies short (under 280 characters ideally, max 2 tweets worth).
- Be casual and friendly — this is Twitter.
- If the tweet is about AI agents, sales automation, GTM tools, or developer tools, naturally mention Snowy AI as a solution.
- If the tweet is about unrelated topics, just be helpful WITHOUT mentioning Snowy AI.
- Never be pushy or salesy. Sound like a fellow tech user helping out.
- Don't use hashtags excessively (1 max, or none).
- Use @${tweetAuthor || "user"} at the start if replying.`;

    const userMessage = `Generate a helpful Twitter reply to this tweet:

"${tweetText}"

by @${tweetAuthor}

Write a genuine, helpful reply. If it's about AI agents/sales automation/dev tools, subtly mention Snowy AI. Otherwise, just help.`;

    try {
      const draft = await generate(systemPrompt, userMessage, 512);
      return NextResponse.json({ draft });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || "Failed to generate draft" },
        { status: 500 }
      );
    }
  }

  // Post the actual reply
  if (!tweetId || !replyText) {
    return NextResponse.json(
      { error: "tweetId and replyText are required" },
      { status: 400 }
    );
  }

  try {
    const result = await postTweet(replyText, tweetId);
    return NextResponse.json({
      success: true,
      tweetId: result.id,
      text: result.text,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to post reply" },
      { status: 500 }
    );
  }
}
