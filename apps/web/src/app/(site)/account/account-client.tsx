"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PhoneLogin } from "@/components/phone-login";
import { SectionTitle } from "@/components/patterns";
import { api, appointmentDate, calendarHref, money, todayInShop, type AppointmentInfo, type Catalog, type CustomerInfo } from "@/lib/client-api";
import { DayPicker, SlotPicker, upcomingShopDays } from "@/components/slot-picker";
import { site } from "@/lib/site";

export function AccountClient() {
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AppointmentInfo | null>(null);
  const [date, setDate] = useState(todayInShop);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadAppointments = useCallback(async () => {
    const result = await api<{ appointments: AppointmentInfo[] }>("appointments");
    setAppointments(result.appointments);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api<{ customer: CustomerInfo | null }>("session"), api<Catalog>("catalog")])
      .then(async ([session, data]) => {
        if (!active) return;
        setCustomer(session.customer); setCatalog(data);
        if (session.customer) await loadAppointments();
      })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAppointments]);

  useEffect(() => {
    if (!editing || !date) return;
    const ctrl = new AbortController();
    setSlotsLoading(true); setSlots([]); setStartsAt("");
    api<{ slots: string[] }>(`availability?service=${editing.serviceId}&date=${date}`, undefined, ctrl.signal)
      .then((r) => setSlots(r.slots))
      .catch((e) => { if (!ctrl.signal.aborted) setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setSlotsLoading(false); });
    return () => ctrl.abort();
  }, [editing, date]);

  async function signedIn(user: CustomerInfo) {
    setCustomer(user); setError("");
    try { await loadAppointments(); } catch (e) { setError((e as Error).message); }
  }

  async function changeAppointment(a: AppointmentInfo, cancel: boolean) {
    if (cancel && !window.confirm(`Cancel your ${a.serviceName} on ${appointmentDate(a.startsAt)}?`)) return;
    setBusy(true); setError("");
    try {
      await api(`appointments/${cancel ? "cancel" : "reschedule"}`, { id: a.id, ...(cancel ? {} : { startsAt }) });
      setEditing(null);
      await loadAppointments();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      await api("auth/logout", {});
      setCustomer(null); setAppointments([]); setEditing(null); setError("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="mx-auto max-w-4xl px-5 pt-16">
      <SectionTitle as="h1" kicker="Same chair. Next cut." title={customer ? `Aloha, ${customer.name}.` : "My Ohana"} />
      {error && <p role="alert" className="booking-error mb-6">{error}</p>}
      {loading ? <p role="status">Opening your account...</p> : !customer ? (
        <div className="max-w-lg"><PhoneLogin onSignedIn={signedIn} /></div>
      ) : <>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sand">{customer.phone}</p>
          <div className="flex gap-3"><Link className="booking-primary" href="/book">Book another cut</Link><button className="booking-secondary" disabled={busy} onClick={logout}>Sign out</button></div>
        </div>
        <h2 className="font-display mb-5 text-3xl">Your Appointments</h2>
        {!appointments.length && <p className="ohana-panel text-sand">No appointments yet. Your next fresh cut starts here.</p>}
        <div className="space-y-4">
          {appointments.map((a) => {
            const changeable = a.status === "confirmed" && Date.parse(a.startsAt) - now >= (catalog?.settings.cancellationHours ?? 24) * 3600_000;
            return (
              <article key={a.id} className="ohana-panel space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="booking-eyebrow">{a.status} / #{a.id}</p><h3 className="font-display mt-2 text-3xl">{a.serviceName}</h3><p className="text-reef mt-1">{appointmentDate(a.startsAt)}</p></div>
                  <p className="text-sand">{money(a.priceCents)}</p>
                </div>
                {a.notes && <p className="text-sand text-sm">{a.notes}</p>}
                {a.status === "confirmed" && Date.parse(a.startsAt) > now && <div className="flex flex-wrap gap-3">
                  <a className="booking-secondary" download={`ohana-${a.id}.ics`} href={calendarHref(a)}>Add to calendar</a>
                  {changeable ? <>
                    {catalog?.settings.bookingEnabled && <button className="booking-secondary" disabled={busy} onClick={() => { setEditing(editing?.id === a.id ? null : a); setDate(todayInShop()); setStartsAt(""); setError(""); }}>Change time</button>}
                    <button className="booking-secondary" disabled={busy} onClick={() => changeAppointment(a, true)}>Cancel visit</button>
                  </> : <p className="text-sand text-sm">For changes within {catalog?.settings.cancellationHours} hours, <a className="text-reef underline" href={site.phoneHref}>call the shop</a>.</p>}
                </div>}
                {editing?.id === a.id && <div className="border-lava space-y-4 border-t pt-5">
                  <p className="text-sand text-sm">Your original time stays reserved until a new time is confirmed. All times are Pacific.</p>
                  <DayPicker days={upcomingShopDays((catalog?.settings.bookingDays ?? 14) + 1)} value={date} onChange={(d) => { setDate(d); setStartsAt(""); }} />
                  <SlotPicker slots={slots} value={startsAt} onChange={setStartsAt} loading={slotsLoading} empty="No open times. Try another date." />
                  <button className="booking-primary" disabled={busy || !startsAt || slotsLoading} onClick={() => changeAppointment(a, false)}>{busy ? "Updating..." : "Confirm new time"}</button>
                </div>}
              </article>
            );
          })}
        </div>
        <p className="text-sand mt-6 text-sm">Showing your latest visits. Need a hand? <a className="text-reef" href={site.phoneHref}>{site.phone}</a></p>
      </>}
    </section>
  );
}
