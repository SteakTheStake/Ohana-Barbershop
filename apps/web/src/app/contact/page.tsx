import { Icon } from "@/components/icon";
import { SectionTitle } from "@/components/patterns";
import { site } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Call, text, or email Ohana Barbershop in Albany, OR. Find hours, location, and social links for Spencer's island-style barbershop.",
  openGraph: {
    title: "Contact | Ohana Barbershop",
    description:
      "Call, text, or email Ohana Barbershop in Albany, OR. Find hours, location, and social links for Spencer's island-style barbershop.",
    images: ["/logo.webp"],
  },
};

const actions = [
  { label: "Call", value: site.phone, href: site.phoneHref },
  { label: "Text", value: site.phone, href: site.smsHref },
  { label: "Email", value: site.email, href: `mailto:${site.email}` },
  { label: "Instagram", value: "@ohana_barber541", href: site.instagram },
];

export default function Contact() {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <SectionTitle as="h1" kicker="Talk Story" title="Contact" />
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <a
            key={a.label}
            href={a.href}
            className="bg-coal hover:border-reef border-lava rounded-xl border p-6 transition-colors"
          >
            <p className="font-display text-reef text-2xl tracking-widest">{a.label}</p>
            <p className="mt-1 break-all">{a.value}</p>
          </a>
        ))}
      </div>
      <div className="bg-coal border-lava relative mt-3 overflow-hidden rounded-xl border p-6">
        <Icon name="coral" className="bg-current text-reef/15 absolute -right-6 -bottom-6 h-32 w-44" />
        <p className="font-display text-reef text-2xl tracking-widest">Hours & Location</p>
        {site.hours ? (
          <ul className="mt-2 space-y-1">
            {site.hours.map((h) => (
              <li key={h.day} className="flex justify-between">
                <span>{h.day}</span>
                <span className="text-sand">{h.time}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sand mt-1">By appointment · {site.city}, {site.region}</p>
        )}
        {site.address && <p className="mt-2">{site.address}</p>}
      </div>
    </section>
  );
}
