import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET() {
  try {
    let settings = await db.instagramSettings.findFirst();

    if (!settings) {
      settings = await db.instagramSettings.create({ data: {} });
    }

    // Include official API token status
    const oauthToken = await db.instagramOAuthToken.findFirst({
      where: { isActive: true },
    });

    return NextResponse.json({
      ...settings,
      officialApi: oauthToken
        ? {
            connected: true,
            pageId: oauthToken.pageId,
            igUserId: oauthToken.igUserId,
            appId: oauthToken.appId,
            tokenExpiresAt: oauthToken.tokenExpiresAt,
            webhookVerifyToken: oauthToken.webhookVerifyToken,
            tokenStatus:
              oauthToken.tokenExpiresAt && oauthToken.tokenExpiresAt < new Date()
                ? "expired"
                : "active",
          }
        : { connected: false },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      autoDmEnabled,
      maxDmsPerDay,
      minDelaySeconds,
      maxDelaySeconds,
      pollIntervalMin,
    } = body;

    let settings = await db.instagramSettings.findFirst();

    if (!settings) {
      settings = await db.instagramSettings.create({
        data: {
          autoDmEnabled: autoDmEnabled ?? false,
          maxDmsPerDay: maxDmsPerDay ?? 20,
          minDelaySeconds: minDelaySeconds ?? 30,
          maxDelaySeconds: maxDelaySeconds ?? 120,
          pollIntervalMin: pollIntervalMin ?? 60,
        },
      });
    } else {
      settings = await db.instagramSettings.update({
        where: { id: settings.id },
        data: {
          ...(autoDmEnabled !== undefined && { autoDmEnabled }),
          ...(maxDmsPerDay !== undefined && { maxDmsPerDay }),
          ...(minDelaySeconds !== undefined && { minDelaySeconds }),
          ...(maxDelaySeconds !== undefined && { maxDelaySeconds }),
          ...(pollIntervalMin !== undefined && { pollIntervalMin }),
        },
      });
    }

    // Handle official API token setup
    if (body.appId && body.accessToken && body.pageId) {
      const webhookVerifyToken = body.webhookVerifyToken || crypto.randomUUID();

      await db.instagramOAuthToken.upsert({
        where: { pageId: body.pageId },
        create: {
          pageId: body.pageId,
          igUserId: body.igUserId || null,
          appId: body.appId,
          appSecret: body.appSecret || "",
          accessToken: body.accessToken,
          webhookVerifyToken,
          tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
        },
        update: {
          igUserId: body.igUserId || undefined,
          appId: body.appId,
          appSecret: body.appSecret || undefined,
          accessToken: body.accessToken,
          tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : undefined,
        },
      });
    }

    // Handle disconnect official API
    if (body.disconnectOfficialApi) {
      await db.instagramOAuthToken.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
