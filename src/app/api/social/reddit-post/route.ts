import { NextRequest, NextResponse } from "next/server";
import { postToReddit, verifyRedditCredentials } from "@/lib/reddit-post";

/**
 * POST /api/social/reddit-post
 * Body:
 *   { action: "verify" }                                → checks if session cookie is valid
 *   { subreddit, title, text }                          → self (text) post
 *   { subreddit, title, url }                           → link post
 */
export async function POST(request: NextRequest) {
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Verify-only mode — no post made
    if (body.action === "verify") {
        const result = await verifyRedditCredentials();
        return NextResponse.json(result);
    }

    const { subreddit, title, text, url } = body as {
        subreddit?: string;
        title?: string;
        text?: string;
        url?: string;
    };

    if (!subreddit || !title) {
        return NextResponse.json({ error: "subreddit and title are required" }, { status: 400 });
    }

    if (!text && !url) {
        return NextResponse.json(
            { error: "Either text (self post) or url (link post) is required" },
            { status: 400 }
        );
    }

    try {
        const result = await postToReddit({ subreddit, title, text, url });
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json(result);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Reddit post failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
