import { AcuityEmbed } from "@/components/acuity-embed";
import { SectionTitle } from "@/components/patterns";
import { services, site } from "@/lib/site";

export const metadata = { title: "Book" };

export default async function Book({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const selected = services.find((s) => s.slug === service);

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
