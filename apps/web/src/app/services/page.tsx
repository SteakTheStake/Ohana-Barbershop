import { BookButton } from "@/components/chrome";
import { SectionTitle } from "@/components/patterns";
import { ServiceList } from "@/components/service-list";

export const metadata = { title: "Services & Prices" };

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
