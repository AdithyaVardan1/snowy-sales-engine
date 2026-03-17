import { NextRequest, NextResponse } from "next/server";
import {
    exchangeLinkedInCode,
    saveLinkedInToken,
    getLinkedInMe,
} from "@/lib/linkedin";

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/social/linkedin-callback`;

/**
 * GET /api/social/linkedin-callback?code=...&state=...
 * LinkedIn redirects here after the user authorizes the app.
 * Exchanges the code for an access token, fetches the user's URN,
 * and stores both in the DB + prints them to the console.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(
            new URL(`/dashboard/social?linkedin_error=${encodeURIComponent(error)}`, request.url)
        );
    }

    if (!code) {
        return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
    }

    try {
        const tokenData = await exchangeLinkedInCode(code, REDIRECT_URI);
        const profile = await getLinkedInMe(tokenData.access_token);

        await saveLinkedInToken(tokenData.access_token, tokenData.expires_in, profile.name, profile.urn);

        // Log the URN so the user can add it to .env.local
        console.log(
            `[LinkedIn] Connected! Person URN: ${profile.urn}  Name: ${profile.name}`
        );
        console.log(`[LinkedIn] Add to .env.local: LINKEDIN_PERSON_URN=${profile.urn}`);

        return NextResponse.redirect(
            new URL(
                `/dashboard/social?linkedin_connected=1&urn=${encodeURIComponent(profile.urn)}&name=${encodeURIComponent(profile.name)}`,
                request.url
            )
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "OAuth callback failed";
        console.error("[LinkedIn] OAuth callback error:", msg);
        return NextResponse.redirect(
            new URL(`/dashboard/social?linkedin_error=${encodeURIComponent(msg)}`, request.url)
        );
    }
}
