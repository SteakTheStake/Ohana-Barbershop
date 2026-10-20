import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { DateTime } from "luxon";
import { getCMS } from "@/lib/cms";
import { calendarFeed, visitDetails, CALENDAR_TOKEN_KEY } from "@/lib/calendar";
import { site } from "@/lib/site";
import type { Customer } from "@/payload-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => new NextResponse("Not found.", { status: 404 });

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const provided = (await context.params).token ?? "";
  if (!/^[0-9a-f]{64}$/.test(provided)) return notFound();
  try {
    const payload = await getCMS();
    const expected = await payload.kv.get<string>(CALENDAR_TOKEN_KEY);
    const match = typeof expected === "string" &&
      timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest());
    if (!match) return notFound();
    const since = DateTime.utc().minus({ days: 14 }).toISO()!;
    const [visits, blocks] = await Promise.all([
      payload.find({ collection: "appointments", depth: 1, pagination: false, sort: "startsAt",
        where: { and: [{ startsAt: { greater_than_equal: since } }, { status: { not_equals: "cancelled" } }] } }),
      payload.find({ collection: "time-off", pagination: false, sort: "startsAt",
        where: { endsAt: { greater_than_equal: since } } }),
    ]);
    const events = [
      ...visits.docs.map((visit) => {
        const customer = typeof visit.customer === "object" ? visit.customer : null;
        const safe = { customer: (customer ?? { name: "Customer", phone: "" }) as Customer, notes: visit.notes };
        return {
          uid: `visit-${visit.id}@ohana-shop`, summary: `${visit.serviceName} — ${safe.customer.name}`,
          description: `Visit status: ${visit.status}\n${visitDetails(safe)}`, location: site.address,
          startsAt: visit.startsAt, endsAt: visit.endsAt, stampedAt: visit.updatedAt,
        };
      }),
      ...blocks.docs.map((block) => ({
        uid: `block-${block.id}@ohana-shop`, summary: `Time off — ${block.reason}`,
        startsAt: block.startsAt, endsAt: block.endsAt, stampedAt: block.updatedAt,
      })),
    ];
    return new NextResponse(calendarFeed(site.name, events), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="ohana-shop.ics"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    console.error("Calendar feed request failed.");
    return new NextResponse("The calendar is unavailable right now. Please try again shortly.", { status: 503 });
  }
}
