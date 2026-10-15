import Link from "next/link";
import { BookButton } from "@/components/chrome";
import { Greeting } from "@/components/greeting";
import { Icon } from "@/components/icon";
import { OceanText } from "@/components/ocean-text";
import { NihoBand, SectionTitle, WaveDivider } from "@/components/patterns";
import { ServiceList } from "@/components/service-list";
import { site } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Island Vibez. Clean Cuts.",
  description:
    "Island-style barbershop in Albany, OR. Haircuts, skin fades, beard trims, and keiki kutz. Book online or call us.",
  openGraph: {
    title: "Island Vibez. Clean Cuts. | Ohana Barbershop",
    description:
      "Island-style barbershop in Albany, OR. Haircuts, skin fades, beard trims, and keiki kutz. Book online or call us.",
    images: ["/logo.webp"],
  },
};

export default function Home() {
  return (
    <>
      <section className="bg-kapa relative overflow-hidden">
        <div className="from-reef/15 absolute inset-0 bg-gradient-to-b to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Greeting />
            <h1 className="font-display mt-3 text-7xl leading-[0.9] tracking-wide lg:text-8xl">
              <OceanText>Island Vibez.</OceanText>
              <br />
              <span className="shine-text">
                Clean Cuts.
                {[
                  ["8%", "10%", "0.4s"],
                  ["45%", "-5%", "1.3s"],
                  ["80%", "20%", "2.1s"],
                  ["65%", "75%", "2.8s"],
                ].map(([left, top, delay]) => (
                  <span key={left} aria-hidden className="sparkle" style={{ left, top, animationDelay: delay }} />
                ))}
              </span>
            </h1>
            <p className="text-bone/70 mt-5 max-w-sm">Traditional barbering. Everyone&apos;s ohana.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BookButton />
              <Link
                href="/services"
                className="border-bone/30 hover:border-reef font-display rounded-md border px-6 py-3 text-xl tracking-widest"
              >
                Prices
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-64 md:w-80">
            {/* <Icon name="turtle" className="bg-current text-reef/10 absolute -inset-12 h-[calc(100%+6rem)] w-[calc(100%+6rem)]" /> */}
            <link rel="preload" as="image" href="/logo-hero.avif" type="image/avif" fetchPriority="high" />
            <picture>
              <source srcSet="/logo-hero.avif" type="image/avif" />
              <img src="/logo-hero.webp" alt="Ohana Barbershop logo" width={590} height={796} className="logo-dark relative" fetchPriority="high" decoding="async" />
            </picture>
          </div>
        </div>
        <WaveDivider className="text-reef/40" />
      </section>

      <section className="mx-auto max-w-4xl px-5 pt-20">
        <SectionTitle kicker="Menu" title="Services" />
        <ServiceList />
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-24">
        <div className="bg-coal grid overflow-hidden rounded-2xl md:grid-cols-3">
          {[
            ["Hot Towel", "Every beard trim."],
            ["Keiki Friendly", "Kids 10 & under."],
            ["Book Online", "24/7 via Acuity."],
          ].map(([t, d]) => (
            <div key={t} className="border-lava border-b p-8 md:border-r md:border-b-0 last:border-0">
              <NihoBand className="text-ember mb-4 !w-12" />
              <p className="font-display text-3xl tracking-wide">{t}</p>
              <p className="text-sand text-sm">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-24 text-center">
        <Icon name="surf" className="bg-current text-sand mb-4 h-14 w-24" />
        <p className="font-display text-5xl tracking-wide md:text-6xl">
          Come Relax. <span className="text-reef">Hang Loose.</span>
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <BookButton />
          <a
            href={site.instagram}
            target="_blank"
            rel="noreferrer"
            className="border-bone/30 hover:border-reef font-display rounded-md border px-6 py-3 text-xl tracking-widest"
          >
            @ohana_barber541
          </a>
        </div>
      </section>
    </>
  );
}
