"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SectionTitle } from "@/components/patterns";
import { PhoneLogin } from "@/components/phone-login";
import { api, appointmentDate, calendarHref, money, todayInShop, type AppointmentInfo, type Catalog, type CustomerInfo } from "@/lib/client-api";
import { DayPicker, SlotPicker, upcomingShopDays } from "@/components/slot-picker";
import { site } from "@/lib/site";
import { SaveUncertain, useSaveRequest } from "@/lib/save-client";

export function BookClient() {
  const params = useSearchParams();
  const slug = params.get("service");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayInShop);
  const [slots, setSlots] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [slotLoading, setSlotLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slotError, setSlotError] = useState("");
  const [confirmation, setConfirmation] = useState<AppointmentInfo | null>(null);
  const [refresh, setRefresh] = useState(0);
  const saveRequest = useSaveRequest();
  const [pendingRequest, setPendingRequest] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([api<Catalog>("catalog", undefined, ctrl.signal), api<{ customer: CustomerInfo | null }>("session", undefined, ctrl.signal)])
      .then(([data, session]) => {
        setCatalog(data); setCustomer(session.customer);
        setServiceId(String((data.services.find((s) => s.slug === slug) ?? data.services[0])?.id ?? ""));
      })
      .catch((e) => { if (!ctrl.signal.aborted) setError(e.message); });
    return () => ctrl.abort();
  }, [slug]);

  useEffect(() => {
    if (!serviceId || !date || !catalog?.settings.bookingEnabled) return;
    const ctrl = new AbortController();
    setSlotLoading(true); setSlotError(""); setSlots([]);
    api<{ slots: string[] }>(`availability?service=${serviceId}&date=${date}`, undefined, ctrl.signal)
      .then((data) => setSlots(data.slots))
      .catch((e) => { if (!ctrl.signal.aborted) setSlotError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setSlotLoading(false); });
    return () => ctrl.abort();
  }, [serviceId, date, catalog?.settings.bookingEnabled, refresh]);

  const selected = catalog?.services.find((s) => String(s.id) === serviceId);
  async function book() {
    if (!selected || !startsAt) return;
    setSaving(true); setError("");
    const data = pendingRequest ?? saveRequest({ serviceId: selected.id, startsAt, notes });
    setPendingRequest(data);
    try {
      const result = await api<{ appointment: AppointmentInfo }>("appointments", data);
      setPendingRequest(null);
      setConfirmation(result.appointment);
    } catch (e) {
      setError((e as Error).message);
      if (!(e instanceof SaveUncertain)) { setPendingRequest(null); setStartsAt(""); setRefresh((n) => n + 1); }
    } finally { setSaving(false); }
  }

  if (confirmation) return (
    <section className="mx-auto max-w-3xl px-5 pt-16">
      <SectionTitle as="h1" kicker="You're on the books" title="See You In The Chair." />
      <div className="ohana-panel space-y-5">
        <p className="booking-eyebrow">Confirmed / #{confirmation.id}</p>
        <h2 className="font-display text-4xl">{confirmation.serviceName}</h2>
        <p className="text-reef text-xl">{appointmentDate(confirmation.startsAt)}</p>
        <p>{money(confirmation.priceCents)} - pay at the shop. No online payment was taken.</p>
        <p className="text-sand">{site.address}</p>
        <div className="flex flex-wrap gap-3">
          <a className="booking-primary" href={calendarHref(confirmation)} download={`ohana-${confirmation.id}.ics`}>Add to calendar</a>
          <Link className="booking-secondary" href="/account">Manage appointment</Link>
        </div>
        <p className="text-sand text-sm">Please give at least {catalog?.settings.cancellationHours} hours&apos; notice for changes. Your confirmation stays in your account; no reminder texts are sent yet.</p>
      </div>
    </section>
  );

  if (pendingRequest) return <section className="mx-auto max-w-3xl px-5 pt-16">
    <SectionTitle as="h1" kicker="Keep this page open" title="Checking Your Booking." />
    <div className="ohana-panel space-y-5">
      <p>We are checking your original booking before allowing another one. Retrying uses the same save ID and will not create a duplicate.</p>
      {error && <p role="alert" className="booking-error">{error}</p>}
      <button className="booking-primary" disabled={saving} onClick={book}>{saving ? "Checking..." : "Check saved booking safely"}</button>
      <Link className="booking-secondary" href="/account">Check my appointments</Link>
    </div>
  </section>;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-16">
      <SectionTitle as="h1" kicker="Make time for yourself" title="Your Chair Is Waiting." />
      <p className="text-sand -mt-3 mb-8 max-w-xl">Pick your cut. Find your time. We&apos;ll take care of the rest. All appointment times are Pacific time in Albany, Oregon.</p>
      {error && <p role="alert" className="booking-error mb-6">{error}</p>}
      {!catalog ? <p role="status">Loading the booking desk...</p> : !catalog.settings.bookingEnabled ? (
        <div className="ohana-panel space-y-5">
          <h2 className="font-display text-3xl">Online Booking Opens Soon</h2>
          <p>{catalog.settings.announcement || "We're getting the chair ready. Call or text to book."}</p>
          <div className="flex flex-wrap gap-3"><a className="booking-primary" href={site.phoneHref}>Call {site.phone}</a><a className="booking-secondary" href={site.smsHref}>Text the shop</a><Link className="booking-secondary" href="/account">My appointments</Link></div>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-8">
            <div>
              <h2 className="booking-step"><span>01</span> Choose Your Cut</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {catalog.services.map((s) => (
                  <button key={s.id} type="button" aria-pressed={String(s.id) === serviceId} className={`service-choice ${String(s.id) === serviceId ? "is-selected" : ""}`} onClick={() => { setServiceId(String(s.id)); setStartsAt(""); }}>
                    <span className="flex items-start justify-between gap-3"><span className="font-display text-2xl">{s.name}</span><span className="text-reef font-display text-2xl">{money(s.priceCents)}</span></span>
                    <span className="text-sand mt-1 block text-sm">{s.description}</span>
                    <span className="text-sand/70 mt-3 block text-xs uppercase tracking-widest">{s.durationMinutes} minutes</span>
                  </button>
                ))}
              </div>
              {!catalog.services.length && <p className="text-sand">No services are available online right now. Please call the shop.</p>}
            </div>
            <div>
              <h2 className="booking-step"><span>02</span> Find Your Time</h2>
              <DayPicker days={upcomingShopDays(catalog.settings.bookingDays + 1)} value={date} onChange={(d) => { setDate(d); setStartsAt(""); }} />
              <div className="mt-5" aria-live="polite">
                <SlotPicker slots={slots} value={startsAt} onChange={setStartsAt} loading={slotLoading} error={slotError} />
              </div>
            </div>
            <label className="booking-label">Anything we should know? <span className="text-sand/60 text-xs">(optional)</span>
              <textarea className="booking-input min-h-24" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="A style in mind, or something to make your visit more comfortable..." />
            </label>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="ohana-panel space-y-4">
              <p className="booking-eyebrow">Your Visit</p>
              <h2 className="font-display text-3xl">{selected?.name || "Choose a service"}</h2>
              <p className="text-reef">{startsAt ? appointmentDate(startsAt) : "Choose an available time"}</p>
              {selected && <p className="text-sand">{selected.durationMinutes} minutes / {money(selected.priceCents)} / Pay at the shop</p>}
              {customer ? <>
                <p className="border-lava border-t pt-4 text-sm">Aloha, {customer.name}. Booking with {customer.phone}.</p>
                <button className="booking-primary w-full" disabled={!startsAt || !selected || saving || slotLoading} onClick={book}>{saving ? "Reserving your chair..." : "Confirm appointment"}</button>
                <Link href="/account" className="text-sand block text-center text-sm underline underline-offset-4">My account & appointments</Link>
              </> : <p className="text-sand text-sm">Sign in with your phone to confirm. Choosing a time does not reserve it until you confirm.</p>}
              <p className="text-sand/70 text-xs">Changes require {catalog.settings.cancellationHours} hours&apos; notice. No deposit required.</p>
            </div>
            {!customer && <PhoneLogin onSignedIn={setCustomer} />}
          </aside>
        </div>
      )}
      <p className="text-sand mt-8 text-sm">Need a hand? Call <a href={site.phoneHref} className="text-reef">{site.phone}</a>.</p>
    </section>
  );
}
