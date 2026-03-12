import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, auth API, webhooks, and OAuth callbacks
  if (
    pathname === "/login" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/instagram/oauth/callback")
  ) {
    return NextResponse.next();
  }

  // Allow internal server-to-server calls (e.g. scheduler)
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET || "snowy-internal-2026";
  if (internalSecret === expectedSecret) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Simple JWT structure check (header.payload.signature)
  const parts = token.split(".");
  if (parts.length !== 3) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check expiry from payload
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
