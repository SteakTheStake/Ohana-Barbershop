import { NextRequest, NextResponse } from "next/server";
import { appOrigin, ownerOrigin } from "@/lib/app-origins";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo";

export async function POST(request: NextRequest) {
  if (!demoEnabled()) return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (!origin || ![appOrigin(), ownerOrigin()].includes(origin)) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(new URL("/demo", origin), { status: 303, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
  return response;
}
