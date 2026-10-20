import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { Footer, Header, MobileBookBar } from "@/components/chrome";
import { site } from "@/lib/site";
import { getCMS } from "@/lib/cms";
import "../globals.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Albany, OR`, template: `%s | ${site.name}` },
  description: "Island-style barbershop in Albany, OR. Haircuts, skin fades, beard trims, keiki kutz.",
  openGraph: { images: ["/large-logo.png"], siteName: site.name },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BarberShop",
  name: site.name,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  image: `${site.url}/large-logo.png`,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.streetAddress,
    addressLocality: site.city,
    addressRegion: site.region,
    postalCode: site.postalCode,
    addressCountry: "US",
  },
  sameAs: [site.instagram, site.facebook],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const payload = await getCMS();
  const { docs: services } = await payload.find({
    collection: "services", where: { active: { equals: true } }, sort: "sortOrder", pagination: false,
  });
  const structuredData = { ...jsonLd, makesOffer: services.map((s) => ({
    "@type": "Offer", price: s.priceCents / 100, priceCurrency: "USD",
    itemOffered: { "@type": "Service", name: s.name },
  })) };
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${bebas.variable} ${inter.variable}`}>
      <body className="pb-20 md:pb-0" suppressHydrationWarning>
        <Header />
        <main>{children}</main>
        <Footer />
        <MobileBookBar />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
