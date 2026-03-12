import { NextRequest, NextResponse } from "next/server";
import {
    getLinkedInAuthUrl,
    exchangeLinkedInCode,
    saveLinkedInToken,
    getLinkedInMe,
} from "@/lib/linkedin";

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/social/linkedin-callback`;

/** GET /api/social/linkedin-auth  →  returns the URL to kick off OAuth */
export async function GET() {
    try {
        const url = getLinkedInAuthUrl(REDIRECT_URI);
        return NextResponse.json({ url });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to build auth URL";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
