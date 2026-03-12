import { NextRequest, NextResponse } from "next/server";
import { replyToRedditPost } from "@/lib/reddit-post";

/**
 * POST /api/community/reddit-reply
 * Body: { thingId: "t3_abc123", text: "reply text" }
 *
 * Sends a comment reply to a Reddit post using the session cookie.
 */
export async function POST(request: NextRequest) {
    let body: { thingId?: string; text?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { thingId, text } = body;

    if (!thingId || !text) {
        return NextResponse.json({ error: "thingId and text are required" }, { status: 400 });
    }

    try {
        const result = await replyToRedditPost(thingId, text);
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json(result);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Reddit reply failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
