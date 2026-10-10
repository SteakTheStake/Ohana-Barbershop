import { BookButton } from "@/components/chrome";
import { Icon } from "@/components/icon";
import { SectionTitle } from "@/components/patterns";

export const metadata = { title: "About" };

const facts = [
  ["From", "Hauʻula, North Shore Oʻahu"],
  ["Now", "Albany, Oregon"],
  ["Ohana", "Annie, Kiaʻi, Edwina, Makaia"],
];

export default function About() {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <SectionTitle kicker="Your Barber" title="Meet Spencer" />
      <div className="grid gap-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-bone/80 max-w-md text-lg">
            Locally owned. Fair prices. Aloha spirit in every cut.
          </p>
          <dl className="divide-lava border-lava mt-8 divide-y border-y">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-6 py-4">
                <dt className="text-reef font-display w-20 text-xl tracking-widest">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <BookButton className="mt-8" />
        </div>
        <Icon name="flower" className="bg-current text-ember/40 hidden h-56 w-56 md:block" />
      </div>
    </section>
  );
}
