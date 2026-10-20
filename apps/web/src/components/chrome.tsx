import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import { Icon } from "./icon";


const nav = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/shop", label: "Shop" },
  { href: "/contact", label: "Contact" },
  { href: "/account", label: "My Ohana" },
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
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-5">
      <div className="border-lava/80 bg-ink/90 shadow-ink/60 mx-auto max-w-6xl overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-4 py-2 md:px-5">
          <Link href="/" className="flex items-center gap-3" aria-label={site.name}>
            <Image src="/small-logo.png" alt="" width={44} height={44} className="h-11 w-auto" priority />
            <span className="font-display text-2xl tracking-widest">Ohana</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-reef text-sm tracking-[0.2em] uppercase transition-colors py-2 -my-2">
                {n.label}
              </Link>
            ))}
          </nav>
          <BookButton className="!px-4 !py-2 !text-lg" />
        </div>
        <nav className="border-lava/70 flex justify-around border-t px-2 py-2 md:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-reef px-2 py-1 text-xs tracking-[0.15em] uppercase transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-coal wave-edge relative mt-24 overflow-hidden">
      <Icon
        name="puff"
        className="bg-gradient-to-b from-reef/20 to-transparent absolute top-1/2 left-[-3.2rem] h-[24rem] w-[32rem] -translate-y-1/2 -rotate-12 pointer-events-none"
      />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-3xl tracking-widest">Ohana Barbershop</p>
          <p className="text-bone mt-2 text-sm italic">A hui hou kākou</p>
          <p className="text-sand/70 text-xs">Until we meet again. Same chair, next cut.</p>
          <p className="text-sand mt-1 text-sm">
            {site.city}, {site.region} · Mahalo
          </p>
        </div>
        <div className="flex items-center justify-center">
          <div className="space-y-1 text-center text-sm">
            <a href={site.phoneHref} className="hover:text-reef block py-1.5 -my-1.5">{site.phone}</a>
            <a href={`mailto:${site.email}`} className="hover:text-reef block py-1.5 -my-1.5">{site.email}</a>
            {site.address && <p>{site.address}</p>}
          </div>
        </div>
        <div className="flex gap-6 text-sm tracking-[0.2em] uppercase md:justify-end">
          <a href={site.instagram} target="_blank" rel="noreferrer" className="hover:text-reef py-1.5 -my-1.5">Instagram</a>
          <a href={site.facebook} target="_blank" rel="noreferrer" className="hover:text-reef py-1.5 -my-1.5">Facebook</a>
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
