import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginInstagram, checkInstagramSession } from "@/lib/instagram";

export async function GET() {
  try {
    const account = await db.socialAccount.findFirst({
      where: { platform: "instagram", isDefault: true },
    }) || await db.socialAccount.findFirst({
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
    const { username, password, verificationCode, challengeContext } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password required" },
        { status: 400 }
      );
    }

    const result = await loginInstagram(username, password, verificationCode, challengeContext);

    return NextResponse.json({
      connected: true,
      username: result.username,
      userId: result.userId,
    });
  } catch (error: any) {
    const msg = error.message || "Login failed";
    // Return 2FA/challenge flag so frontend can show verification options
    if (/two_factor/i.test(msg) || /challenge/i.test(msg)) {
      return NextResponse.json(
        {
          error: msg,
          needs2FA: true,
          challengeContext: error.challengeContext,
          stepName: error.stepName,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const acct = await db.socialAccount.findFirst({ where: { platform: "instagram" } });
    if (acct) await db.socialAccount.delete({ where: { id: acct.id } }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to disconnect" },
      { status: 500 }
    );
  }
}
