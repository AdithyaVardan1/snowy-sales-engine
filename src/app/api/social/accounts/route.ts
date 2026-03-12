import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwitterCookies } from "@/lib/twitter";
import { verifyLinkedInCookies } from "@/lib/linkedin";

export async function GET() {
  const accounts = await db.socialAccount.findMany();
  const safe = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    username: a.username,
    status: a.status,
    updatedAt: a.updatedAt,
  }));
  return NextResponse.json({ accounts: safe });
}

export async function POST(request: NextRequest) {
  const { platform, cookies } = await request.json();

  if (!platform || !cookies) {
    return NextResponse.json(
      { error: "platform and cookies required" },
      { status: 400 }
    );
  }

  let username: string | undefined;
  let verified = true;
  let cookieCount: number | undefined;

  if (platform === "twitter") {
    // Accept either:
    //  1. Full cookie jar JSON: [{ name: "ct0", value: "..." }, ...]
    //  2. Legacy: { ct0: "...", auth_token: "..." }
    const cookieStr =
      typeof cookies === "string" ? cookies : JSON.stringify(cookies);

    try {
      const result = await verifyTwitterCookies(cookieStr);
      if (!result.valid) {
        return NextResponse.json(
          {
            error:
              "Twitter cookies appear invalid. Make sure ct0 and auth_token are present. " +
              "Export ALL cookies from x.com using a browser extension (EditThisCookie / Cookie-Editor).",
          },
          { status: 400 }
        );
      }
      username = result.username;
      cookieCount = result.cookieCount;
      if (!result.username) verified = false;
    } catch (err: any) {
      console.warn(
        "[Accounts] Twitter verification failed, saving cookies anyway:",
        err.message
      );
      verified = false;
    }

    // Store raw — parseCookieData in twitter.ts handles all formats
    const account = await db.socialAccount.upsert({
      where: { platform },
      create: {
        platform,
        cookies: cookieStr,
        username,
        status: "active",
      },
      update: {
        cookies: cookieStr,
        username,
        status: "active",
      },
    });

    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      username: account.username,
      status: account.status,
      verified,
      cookieCount,
    });
  }

  if (platform === "linkedin") {
    const { li_at, JSESSIONID } = cookies;
    if (!li_at || !JSESSIONID) {
      return NextResponse.json(
        { error: "li_at and JSESSIONID cookies required" },
        { status: 400 }
      );
    }
    const result = await verifyLinkedInCookies(li_at, JSESSIONID);
    if (!result.valid) {
      return NextResponse.json(
        { error: "Invalid LinkedIn cookies" },
        { status: 400 }
      );
    }
    username = result.name;
  } else {
    return NextResponse.json(
      { error: "Unsupported platform" },
      { status: 400 }
    );
  }

  const account = await db.socialAccount.upsert({
    where: { platform },
    create: {
      platform,
      cookies: JSON.stringify(cookies),
      username,
      status: "active",
    },
    update: {
      cookies: JSON.stringify(cookies),
      username,
      status: "active",
    },
  });

  return NextResponse.json({
    id: account.id,
    platform: account.platform,
    username: account.username,
    status: account.status,
    verified,
  });
}
