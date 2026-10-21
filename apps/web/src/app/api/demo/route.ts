import { NextRequest, NextResponse } from "next/server";
import { appOrigin, ownerOrigin } from "@/lib/app-origins";
import { getCMS } from "@/lib/cms";
import { clientAddress, rateLimit, RequestError } from "@/lib/phone-auth";
import { createDemoSession, DEMO_COOKIE, DEMO_SECONDS, demoEnabled, demoPasswordMatches, demoReturnPath } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!demoEnabled()) return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (!origin || ![appOrigin(), ownerOrigin()].includes(origin)) return new NextResponse(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new NextResponse(null, { status: 415 });
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  if (reader) while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    parts.push(value);
  }
  const form = new URLSearchParams(Buffer.concat(parts).toString("utf8"));
  const next = demoReturnPath(form.get("next"));
  const failure = new URL("/demo", origin);
  failure.searchParams.set("next", next);
  try {
    await rateLimit(await getCMS(), "demo-password", clientAddress(request), 10, 60);
  } catch (error) {
    if (!(error instanceof RequestError) || error.status !== 429) throw error;
    failure.searchParams.set("error", "limited");
    return NextResponse.redirect(failure, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  if (!demoPasswordMatches(form.get("password") ?? "")) {
    failure.searchParams.set("error", "password");
    return NextResponse.redirect(failure, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.redirect(new URL(next, origin), { status: 303, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(DEMO_COOKIE, createDemoSession(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: DEMO_SECONDS,
  });
  return response;
}
