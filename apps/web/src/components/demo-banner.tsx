import { demoEnabled } from "@/lib/demo";

export function DemoBanner() {
  if (!demoEnabled()) return null;
  return <aside className="demo-banner" aria-label="Demo notice">
    <span><strong>Private demo.</strong> Unfinished product. No real bookings.</span>
    <a href="/owner">Explore My Shop</a>
    <form action="/api/demo/logout" method="post"><button type="submit">Lock demo</button></form>
  </aside>;
}
