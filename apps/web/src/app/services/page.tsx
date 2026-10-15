import { BookButton } from "@/components/chrome";
import { SectionTitle } from "@/components/patterns";
import { ServiceList } from "@/components/service-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services & Prices",
  description:
    "Full service menu and prices for Ohana Barbershop in Albany, OR. Haircuts, skin fades, buzz cuts, keiki kutz, and beard trims.",
  openGraph: {
    title: "Services & Prices | Ohana Barbershop",
    description:
      "Full service menu and prices for Ohana Barbershop in Albany, OR. Haircuts, skin fades, buzz cuts, keiki kutz, and beard trims.",
    images: ["/logo.webp"],
  },
};

export default function Services() {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <SectionTitle kicker="Menu" title="Services & Prices" />
      <ServiceList />
      <p className="text-sand mt-6 text-sm">Tap a service to book.</p>
      <BookButton className="mt-8" />
    </section>
  );
}
