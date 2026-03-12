import { NextRequest, NextResponse } from "next/server";
import { postTweet } from "@/lib/twitter";

/**
 * POST /api/community/twitter-reply
 * Body: { tweetId: "123456789", text: "reply text" }
 *
 * Posts a reply to a tweet using the Twitter (Twikit) integration.
 */
export async function POST(request: NextRequest) {
  let body: { tweetId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tweetId, text } = body;

  if (!tweetId || !text) {
    return NextResponse.json({ error: "tweetId and text are required" }, { status: 400 });
  }

  try {
    const result = await postTweet(text, tweetId);
    return NextResponse.json({ success: true, id: result.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Twitter reply failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
