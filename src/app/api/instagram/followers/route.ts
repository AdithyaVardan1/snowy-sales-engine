import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInstagramFollowers } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const filter = searchParams.get("filter") || "all"; // "all" | "new" | "dm_sent"

    const where: any = {};
    if (filter === "new") where.isNew = true;
    if (filter === "dm_sent") where.dmSent = true;

    const [followers, total, newCount, dmSentToday] = await Promise.all([
      db.instagramFollower.findMany({
        where,
        orderBy: { firstSeenAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.instagramFollower.count({ where }),
      db.instagramFollower.count({ where: { isNew: true } }),
      db.instagramDM.count({
        where: {
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: "sent",
        },
      }),
    ]);

    return NextResponse.json({ followers, total, newCount, dmSentToday });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch followers" },
      { status: 500 }
    );
  }
}

// POST: Trigger a follower poll — fetches from Instagram and diffs with DB
export async function POST() {
  try {
    const followers = await getInstagramFollowers(200);
    if (!followers) {
      return NextResponse.json({ newFollowers: 0, totalFollowers: 0 });
    }

    let newCount = 0;

    for (const f of followers) {
      const existing = await db.instagramFollower.findUnique({
        where: { igUserId: f.user_id },
      });

      if (!existing) {
        await db.instagramFollower.create({
          data: {
            igUserId: f.user_id,
            username: f.username,
            fullName: f.full_name || null,
            profilePicUrl: f.profile_pic_url || null,
            isPrivate: f.is_private ?? false,
            isNew: true,
            dmSent: false,
          },
        });
        newCount++;
      } else {
        // Update username/name in case it changed
        await db.instagramFollower.update({
          where: { igUserId: f.user_id },
          data: {
            username: f.username,
            fullName: f.full_name || existing.fullName,
            profilePicUrl: f.profile_pic_url || existing.profilePicUrl,
          },
        });
      }
    }

    const totalFollowers = await db.instagramFollower.count();

    if (newCount > 0) {
      await db.activityLog.create({
        data: {
          type: "instagram_followers_polled",
          channel: "instagram",
          details: JSON.stringify({ newCount, totalFollowers }),
        },
      });
    }

    console.log(`[Instagram] Poll complete: ${newCount} new, ${totalFollowers} total`);

    return NextResponse.json({ newFollowers: newCount, totalFollowers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to poll followers" },
      { status: 500 }
    );
  }
}
