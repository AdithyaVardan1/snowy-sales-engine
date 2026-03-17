import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwitterCookies } from "@/lib/twitter";
import { verifyLinkedInCookies } from "@/lib/linkedin";

export async function GET() {
  const accounts = await db.socialAccount.findMany({
    orderBy: [{ platform: "asc" }, { isDefault: "desc" }],
  });
  const safe = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    label: a.label,
    username: a.username,
    status: a.status,
    isDefault: a.isDefault,
    updatedAt: a.updatedAt,
  }));
  return NextResponse.json({ accounts: safe });
}

export async function POST(request: NextRequest) {
  const { platform, cookies, label } = await request.json();

  if (!platform || !cookies) {
    return NextResponse.json(
      { error: "platform and cookies required" },
      { status: 400 }
    );
  }

  const accountLabel = label || "default";

  let username: string | undefined;
  let verified = true;
  let cookieCount: number | undefined;

  if (platform === "twitter") {
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

    const finalLabel = label || username || "default";

    // Check if this is the first account for this platform — auto-set as default
    const existingCount = await db.socialAccount.count({ where: { platform } });

    const account = await db.socialAccount.upsert({
      where: { platform_label: { platform, label: finalLabel } },
      create: {
        platform,
        label: finalLabel,
        cookies: cookieStr,
        username,
        status: "active",
        isDefault: existingCount === 0,
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
      label: account.label,
      username: account.username,
      status: account.status,
      isDefault: account.isDefault,
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

  const finalLabel = label || username || "default";
  const existingCount = await db.socialAccount.count({ where: { platform } });

  const account = await db.socialAccount.upsert({
    where: { platform_label: { platform, label: finalLabel } },
    create: {
      platform,
      label: finalLabel,
      cookies: JSON.stringify(cookies),
      username,
      status: "active",
      isDefault: existingCount === 0,
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
    label: account.label,
    username: account.username,
    status: account.status,
    isDefault: account.isDefault,
    verified,
  });
}

/** PATCH — set default account or update label */
export async function PATCH(request: NextRequest) {
  const { id, isDefault, label } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const account = await db.socialAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (isDefault) {
    // Unset all other defaults for this platform
    await db.socialAccount.updateMany({
      where: { platform: account.platform, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await db.socialAccount.update({
    where: { id },
    data: {
      ...(isDefault !== undefined ? { isDefault } : {}),
      ...(label ? { label } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    platform: updated.platform,
    label: updated.label,
    username: updated.username,
    status: updated.status,
    isDefault: updated.isDefault,
  });
}

/** DELETE — remove a social account */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.socialAccount.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
