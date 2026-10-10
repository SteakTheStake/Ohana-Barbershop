import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { Footer, Header, MobileBookBar } from "@/components/chrome";
import { services, site } from "@/lib/site";
import "./globals.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Albany, OR`, template: `%s | ${site.name}` },
  description: "Island-style barbershop in Albany, OR. Haircuts, skin fades, beard trims, keiki kutz.",
  openGraph: { images: ["/logo.webp"], siteName: site.name },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BarberShop",
  name: site.name,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  image: `${site.url}/logo.webp`,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.streetAddress,
    addressLocality: site.city,
    addressRegion: site.region,
    postalCode: site.postalCode,
    addressCountry: "US",
  },
  sameAs: [site.instagram, site.facebook],
  makesOffer: services.map((s) => ({
    "@type": "Offer",
    price: s.price,
    priceCurrency: "USD",
    itemOffered: { "@type": "Service", name: s.name },
  })),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bebas.variable} ${inter.variable}`}>
      <body className="pb-20 md:pb-0">
        <Header />
        <main>{children}</main>
        <Footer />
        <MobileBookBar />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
