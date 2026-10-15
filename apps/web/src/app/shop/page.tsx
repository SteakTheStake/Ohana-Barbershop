import { NihoBand, SectionTitle } from "@/components/patterns";
import { site } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Ohana Barbershop apparel and merchandise coming soon. Follow us on Instagram for the latest drop from Albany, OR.",
  openGraph: {
    title: "Shop | Ohana Barbershop",
    description:
      "Ohana Barbershop apparel and merchandise coming soon. Follow us on Instagram for the latest drop from Albany, OR.",
    images: ["/logo.webp"],
  },
};

export default function Shop() {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <SectionTitle as="h1" kicker="Merch" title="Shop" />
      <div className="bg-coal bg-kapa border-lava rounded-2xl border p-12 text-center">
        <p className="font-display text-6xl tracking-wide">Apparel Dropping Soon</p>
        <NihoBand className="text-ember mx-auto mt-4 !w-24" />
        <a href={site.instagram} target="_blank" rel="noreferrer" className="text-reef mt-6 inline-block">
          Follow for the drop →
        </a>
      </div>
    </section>
  );
}
