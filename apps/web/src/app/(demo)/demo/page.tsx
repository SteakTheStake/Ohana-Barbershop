import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_COOKIE, demoEnabled, demoReturnPath, validDemoSession } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!demoEnabled()) notFound();
  const params = await searchParams;
  const next = demoReturnPath(params.next);
  if (validDemoSession((await cookies()).get(DEMO_COOKIE)?.value)) redirect(next);
  return <main className="demo-card">
    <p className="demo-eyebrow">Ohana Barbershop / Private Preview</p>
    <h1>A little aloha.<br />A work in progress.</h1>
    <p>This is a private demo of the new Ohana website, not a finished product. Features and details are still being refined.</p>
    <p>Feel free to explore the site and My Shop. Customers and appointments saved here are demo records only. No real bookings, texts, or calendar updates are sent.</p>
    <form action="/api/demo" method="post">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="demo-password">Demo password</label>
      <input id="demo-password" name="password" type="password" autoComplete="current-password" required maxLength={200} autoFocus aria-describedby={params.error ? "demo-error" : undefined} />
      {params.error && <p id="demo-error" role="alert" className="demo-error">{params.error === "limited" ? "Too many attempts. Please wait a minute and try again." : "That password didn't match. Please try again."}</p>}
      <button type="submit">Enter the preview <span aria-hidden="true">&rarr;</span></button>
    </form>
    <p className="demo-note">Made for a conversation, not for taking real bookings.</p>
  </main>;
}
