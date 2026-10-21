import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, demoEnabled, validDemoSession } from "./lib/demo";

export function proxy(request: NextRequest) {
  if (!demoEnabled()) return NextResponse.next();
  const path = request.nextUrl.pathname;
  let response: NextResponse;
  if (path === "/demo" || path === "/api/demo" || path === "/api/demo/logout" ||
    path === "/api/health" || path.startsWith("/_next/static/")) {
    response = NextResponse.next();
  } else if (!validDemoSession(request.cookies.get(DEMO_COOKIE)?.value)) {
    if (path.startsWith("/api/")) {
      response = NextResponse.json({ error: "Enter the demo password to continue." }, { status: 401 });
    } else {
      const url = request.nextUrl.clone();
      url.pathname = "/demo";
      url.search = "";
      url.searchParams.set("next", `${path}${request.nextUrl.search}`);
      response = NextResponse.redirect(url);
    }
  } else if (path === "/admin" || path.startsWith("/admin/")) {
    response = NextResponse.redirect(new URL("/owner", request.url));
  } else {
    response = NextResponse.next();
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
