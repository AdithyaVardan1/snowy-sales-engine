import { NextRequest, NextResponse } from "next/server";
import { searchTweets } from "@/lib/twitter";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const count = parseInt(request.nextUrl.searchParams.get("count") || "20");

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  try {
    const tweets = await searchTweets(query, Math.min(count, 50));
    return NextResponse.json({ tweets, query });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to search tweets" },
      { status: 500 }
    );
  }
}
