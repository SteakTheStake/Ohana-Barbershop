import type { Metadata } from "next";
import "./demo.css";

export const metadata: Metadata = {
  title: "Private Demo | Ohana Barbershop",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
