import { NextResponse } from "next/server";
import { getLinkedInMe, getLinkedInToken } from "@/lib/linkedin";

/**
 * GET /api/social/linkedin-me
 * Returns your LinkedIn profile + person URN using the stored/env token.
 * Call this once to get your LINKEDIN_PERSON_URN value.
 */
export async function GET() {
    try {
        const token = await getLinkedInToken();
        const profile = await getLinkedInMe(token);
        return NextResponse.json({
            name: profile.name,
            urn: profile.urn,
            hint: `Add to .env.local: LINKEDIN_PERSON_URN=${profile.urn}`,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to fetch profile";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
