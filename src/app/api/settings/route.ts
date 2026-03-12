import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SETTING_DEFINITIONS = [
    // Twitter
    { key: "TWITTER_CT0", label: "Twitter ct0 cookie", category: "twitter", secret: true },
    { key: "TWITTER_AUTH_TOKEN", label: "Twitter auth_token cookie", category: "twitter", secret: true },
    { key: "TWITTER_QUERY_ID_CREATE_TWEET", label: "Twitter CreateTweet query ID (optional)", category: "twitter", secret: false },
    { key: "TWITTER_QUERY_ID_SEARCH_TIMELINE", label: "Twitter SearchTimeline query ID (optional)", category: "twitter", secret: false },
    // LinkedIn
    { key: "LINKEDIN_ACCESS_TOKEN", label: "LinkedIn OAuth access token", category: "linkedin", secret: true },
    { key: "LINKEDIN_PERSON_URN", label: "LinkedIn person URN (urn:li:person:...)", category: "linkedin", secret: false },
    { key: "LINKEDIN_CLIENT_ID", label: "LinkedIn app Client ID", category: "linkedin", secret: false },
    { key: "LINKEDIN_CLIENT_SECRET", label: "LinkedIn app Client Secret", category: "linkedin", secret: true },
    // Reddit
    { key: "REDDIT_SESSION_COOKIE", label: "Reddit session cookie", category: "reddit", secret: true },
    // AI
    { key: "GEMINI_API_KEY", label: "Gemini API key", category: "ai", secret: true },
    { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) API key", category: "ai", secret: true },
    // GitHub
    { key: "GITHUB_TOKEN", label: "GitHub personal access token", category: "github", secret: true },
    { key: "GITHUB_REPO_OWNER", label: "GitHub repo owner (e.g. openclaw)", category: "github", secret: false },
    { key: "GITHUB_REPO_NAME", label: "GitHub repo name (e.g. openclaw)", category: "github", secret: false },
    // Community monitoring
    { key: "MONITORED_SUBREDDITS", label: "Monitored subreddits (comma-separated, e.g. openclaw,selfhosted,LocalLLaMA)", category: "community", secret: false },
];

export async function GET() {
    const stored = await db.appSetting.findMany();
    const storedMap = Object.fromEntries(stored.map((s) => [s.key, s]));

    const settings = SETTING_DEFINITIONS.map((def) => {
        const stored = storedMap[def.key];
        return {
            key: def.key,
            label: def.label,
            category: def.category,
            secret: def.secret,
            // Mask secret values — just show if set or not
            value: stored
                ? def.secret
                    ? "••••••••" // masked
                    : stored.value
                : "",
            isSet: !!stored,
            // Also check env var as secondary source
            isSetFromEnv: !stored && !!process.env[def.key],
        };
    });

    return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
    const { key, value } = await request.json();

    if (!key || value === undefined) {
        return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    const def = SETTING_DEFINITIONS.find((d) => d.key === key);
    if (!def) {
        return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
    }

    if (!value.trim()) {
        // Delete the setting (clear it, fall back to env)
        await db.appSetting.deleteMany({ where: { key } });
        return NextResponse.json({ ok: true, action: "deleted" });
    }

    const setting = await db.appSetting.upsert({
        where: { key },
        create: { key, value: value.trim(), label: def.label, category: def.category },
        update: { value: value.trim() },
    });

    return NextResponse.json({ ok: true, id: setting.id });
}
