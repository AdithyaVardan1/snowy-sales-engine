import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginInstagram, checkInstagramSession } from "@/lib/instagram";

export async function GET() {
  try {
    const account = await db.socialAccount.findUnique({
      where: { platform: "instagram" },
    });

    if (!account) {
      return NextResponse.json({ connected: false });
    }

    // Quick session check
    const check = await checkInstagramSession();

    return NextResponse.json({
      connected: check.valid,
      username: account.username,
      status: account.status,
      updatedAt: account.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check account" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password required" },
        { status: 400 }
      );
    }

    const result = await loginInstagram(username, password);

    return NextResponse.json({
      connected: true,
      username: result.username,
      userId: result.userId,
    });
  } catch (error: any) {
    const msg = error.message || "Login failed";
    const status = /two_factor|challenge/i.test(msg) ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE() {
  try {
    await db.socialAccount
      .delete({ where: { platform: "instagram" } })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to disconnect" },
      { status: 500 }
    );
  }
}
