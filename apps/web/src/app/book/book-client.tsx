"use client";

import { useSearchParams } from "next/navigation";
import { AcuityEmbed } from "@/components/acuity-embed";
import { SectionTitle } from "@/components/patterns";
import { services, site } from "@/lib/site";

export function BookClient() {
  const searchParams = useSearchParams();
  const serviceSlug = searchParams.get("service");
  const selected = services.find((s) => s.slug === serviceSlug);

  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <SectionTitle kicker="Schedule" title={selected ? `Book · ${selected.name}` : "Book Now"} />
      <AcuityEmbed typeId={selected?.acuityTypeId} />
      <p className="text-sand mt-4 text-sm">
        Trouble booking? Call <a href={site.phoneHref} className="text-reef">{site.phone}</a>
      </p>
    </section>
  );
}
