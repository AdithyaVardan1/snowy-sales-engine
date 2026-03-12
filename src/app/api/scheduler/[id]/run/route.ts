import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const job = await db.cronJob.findUnique({ where: { id: params.id } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Internal headers for bypassing auth middleware
    const internalHeaders = {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
    };

    // Map job type → internal API endpoint
    // Parse job config for types that need it
    let jobConfig: Record<string, unknown> = {};
    if (job.config) {
        try { jobConfig = JSON.parse(job.config); } catch {}
    }

    const endpointMap: Record<string, { url: string; body: unknown }> = {
        fetch_community: { url: `${baseUrl}/api/community/fetch`, body: { source: "all" } },
        post_social: { url: `${baseUrl}/api/social/publish-due`, body: {} },
        generate_blog: { url: `${baseUrl}/api/blog/publish-due`, body: {} },
        auto_post_tech: { url: `${baseUrl}/api/social/auto-post`, body: jobConfig },
    };

    const endpoint = endpointMap[job.type];
    if (!endpoint) {
        return NextResponse.json({ error: `Unknown job type: ${job.type}` }, { status: 400 });
    }

    let success = false;
    let error: string | undefined;
    let details: unknown;

    try {
        const res = await fetch(endpoint.url, {
            method: "POST",
            headers: internalHeaders,
            body: JSON.stringify(endpoint.body),
        });

        const data = await res.json().catch(() => ({}));
        success = res.ok;
        details = data;
        if (!res.ok) error = JSON.stringify(data);
    } catch (e) {
        error = e instanceof Error ? e.message : String(e);
    }

    await db.cronJob.update({
        where: { id: job.id },
        data: {
            lastRunAt: new Date(),
            lastResult: success ? "success" : "error",
            lastError: error || null,
        },
    });

    return NextResponse.json({ ok: true, success, details, error });
}
