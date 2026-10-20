import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "../globals.css";
import "./owner.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata: Metadata = { title: "My Shop | Ohana Barbershop", robots: { index: false, follow: false } };
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning className={`${bebas.variable} ${inter.variable}`}><body suppressHydrationWarning>{children}</body></html>;
}
