import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import { Icon } from "./icon";
import { NihoBand, WaveDivider } from "./patterns";

const nav = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/shop", label: "Shop" },
  { href: "/contact", label: "Contact" },
];

export function BookButton({ href = "/book", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`bg-ember hover:bg-sand text-ink font-display inline-flex items-center justify-center rounded-md px-6 py-3 text-xl tracking-widest transition-colors ${className}`}
    >
      Book Now
    </Link>
  );
}

export function Header() {
  return (
    <header className="bg-ink/85 sticky top-0 z-40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label={site.name}>
          <Image src="/logo.webp" alt="" width={40} height={53} className="logo-dark h-12 w-auto" priority />
          <span className="font-display text-2xl tracking-widest">Ohana</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-reef text-sm tracking-[0.2em] uppercase">
              {n.label}
            </Link>
          ))}
        </nav>
        <BookButton className="!px-4 !py-2 !text-lg" />
      </div>
      <nav className="border-lava flex justify-around border-t py-2 md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="text-xs tracking-[0.15em] uppercase">
            {n.label}
          </Link>
        ))}
      </nav>
      <NihoBand className="text-lava !h-2" />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-coal relative mt-24 overflow-hidden">
      <WaveDivider className="text-reef/50" />
      <Icon
        name="puff"
        className="bg-gradient-to-b from-reef/20 to-transparent absolute top-1/2 left-[-3.2rem] h-[24rem] w-[32rem] -translate-y-1/2 -rotate-12 pointer-events-none"
      />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-3xl tracking-widest">Ohana Barbershop</p>
          <p className="text-bone mt-2 text-sm italic">A hui hou kākou</p>
          <p className="text-sand/60 text-xs">Until we meet again. Same chair, next cut.</p>
          <p className="text-sand mt-1 text-sm">
            {site.city}, {site.region} · Mahalo
          </p>
        </div>
        <div className="flex items-center justify-center">
          <div className="space-y-1 text-center text-sm">
            <a href={site.phoneHref} className="hover:text-reef block">{site.phone}</a>
            <a href={`mailto:${site.email}`} className="hover:text-reef block">{site.email}</a>
            {site.address && <p>{site.address}</p>}
          </div>
        </div>
        <div className="flex gap-6 text-sm tracking-[0.2em] uppercase md:justify-end">
          <a href={site.instagram} target="_blank" rel="noreferrer" className="hover:text-reef">Instagram</a>
          <a href={site.facebook} target="_blank" rel="noreferrer" className="hover:text-reef">Facebook</a>
        </div>
      </div>
      <p className="text-sand/50 relative z-10 pb-6 text-center text-xs">© {new Date().getFullYear()} {site.name}</p>
    </footer>
  );
}

export function MobileBookBar() {
  return (
    <div className="bg-ink/95 border-lava fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t p-3 md:hidden">
      <a
        href={site.phoneHref}
        className="border-sand font-display flex items-center justify-center rounded-md border text-xl tracking-widest"
      >
        Call
      </a>
      <BookButton />
    </div>
  );
}
