"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ownerAPI } from "@/lib/owner-client";
import { money } from "@/lib/client-api";
import type { OwnerService, OwnerSettings } from "@/lib/owner-types";
import { FormError, useStudioTask, type TaskProps } from "./shared";
import { CalendarPanel } from "./calendar";
import { GoogleCalendarPanel } from "./google-calendar";

export function Shop(props: Pick<TaskProps, "onSaved" | "onAuthError" | "onDirty" | "onBusy"> & { settings: OwnerSettings; services: OwnerService[]; onEditService: (service: OwnerService) => void }) {
  const [settings, setSettings] = useState(props.settings);
  const [hours, setHours] = useState(() => [1, 2, 3, 4, 5, 6, 0].map((day) => props.settings.weeklyHours?.find((h) => h.weekday === String(day)) ?? { weekday: String(day), closed: true, opens: "09:00", closes: "17:00" }));
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const task = useStudioTask(props);
  function changeHour(index: number, field: "closed" | "opens" | "closes", value: string | boolean) {
    setHours((current) => current.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await task.run(async () => { await ownerAPI("settings", { ...settings, weeklyHours: hours }); props.onSaved("Your shop settings are saved."); });
  }
  return <section className="studio-shop">
    <div className="studio-day-bar"><div><p className="studio-kicker">Set it, then get back to the chair</p><h1>Your Shop</h1><p className="studio-muted">Working hours, online booking, and what you charge.</p></div></div>
    <div className="studio-shop-grid">
      <form className="studio-stack" onSubmit={save} onChange={props.onDirty}><fieldset className="studio-stack" disabled={task.busy}>
        <section className="studio-panel studio-stack">
          <div><h2>Online booking</h2><p className="studio-muted">You can always book customers yourself, even when this is off.</p></div>
          <label className="studio-switch"><input type="checkbox" checked={settings.bookingEnabled} onChange={(e) => setSettings({ ...settings, bookingEnabled: e.target.checked })} /><span><strong>Let customers book online</strong><small>{settings.bookingEnabled ? "Customers can see and book your open times." : "Only you can add cuts. Customers see your announcement."}</small></span></label>
          <label className="studio-label">Message for customers<textarea className="studio-input" rows={3} maxLength={500} value={settings.announcement ?? ""} onChange={(e) => setSettings({ ...settings, announcement: e.target.value })} /></label>
        </section>
        <section className="studio-panel studio-stack"><div><h2>Your usual hours</h2><p className="studio-muted">Choose your open days. Use Block time for lunch, holidays, and one-off changes.</p></div>
          <div className="studio-hours-list">{hours.map((h, i) => <div className="studio-hours-row" key={h.weekday}>
            <label className="studio-hours-day"><input type="checkbox" checked={!h.closed} onChange={(e) => changeHour(i, "closed", !e.target.checked)} /><span>{days[Number(h.weekday)]}<small>{h.closed ? "Closed" : "Open"}</small></span></label>
            {!h.closed ? <div className="studio-hour-times"><label><span className="studio-sr-only">{days[Number(h.weekday)]} opens</span><input className="studio-input" type="time" required value={h.opens} onChange={(e) => changeHour(i, "opens", e.target.value)} /></label><span>to</span><label><span className="studio-sr-only">{days[Number(h.weekday)]} closes</span><input className="studio-input" type="time" required value={h.closes} onChange={(e) => changeHour(i, "closes", e.target.value)} /></label></div> : <span className="studio-muted studio-small">No online appointments</span>}
          </div>)}</div><p className="studio-muted studio-small">All hours are Pacific time. Changing hours won&apos;t move or cancel visits already on the books.</p>
        </section>
        <details className="studio-panel studio-policy"><summary>Booking & cancellation rules</summary><div className="studio-stack">
          <label className="studio-label">How far ahead can customers book? <span className="studio-muted">(days)</span><input className="studio-input" type="number" min={1} max={90} step={1} required value={settings.bookingDays} onChange={(e) => setSettings({ ...settings, bookingDays: Number(e.target.value) })} /></label>
          <label className="studio-label">How much notice for a new online booking? <span className="studio-muted">(minutes)</span><input className="studio-input" type="number" min={0} max={10080} step={1} required value={settings.leadMinutes} onChange={(e) => setSettings({ ...settings, leadMinutes: Number(e.target.value) })} /></label>
          <label className="studio-label">Notice needed for customer changes or cancellations <span className="studio-muted">(hours)</span><input className="studio-input" type="number" min={0} max={168} step={1} required value={settings.cancellationHours} onChange={(e) => setSettings({ ...settings, cancellationHours: Number(e.target.value) })} /></label>
          <p className="studio-muted studio-small">These rules are for customer self-service. You can make owner changes without the notice period, and book up to a year ahead.</p>
        </div></details>
        <FormError message={task.error} /><button className="studio-button primary studio-shop-save" type="submit">{task.busy ? "Saving your shop..." : "Save shop settings"}</button>
      </fieldset></form>
      <aside className="studio-stack"><section className="studio-panel"><h2>Services & prices</h2><p className="studio-muted">Prices are in dollars. Tap a service to change its price or cut length.</p>
        <div className="studio-services">{props.services.map((s) => <button key={s.id} className="studio-service-row" onClick={() => props.onEditService(s)} disabled={task.busy}><span><strong>{s.name}</strong><small>{s.durationMinutes} min{s.bufferMinutes ? ` + ${s.bufferMinutes} min cleanup` : ""}{s.active ? "" : " / Not offered online"}</small></span><span><strong>{money(s.priceCents)}</strong><small>Edit</small></span></button>)}</div>
      </section><GoogleCalendarPanel onAuthError={props.onAuthError} /><CalendarPanel onAuthError={props.onAuthError} /><div className="studio-tip"><strong>Need a day away?</strong><p>Leave your usual hours alone. Go to Schedule, tap Block time, and choose Time off.</p></div>
        <details className="studio-panel studio-policy"><summary>Quick help</summary><div className="studio-stack studio-muted">
          <p><strong>Book a cut:</strong> Schedule, Book a cut, choose the customer and an open time, then save.</p>
          <p><strong>Move or cancel:</strong> Tap the visit on your schedule. Changes won&apos;t save until you confirm them.</p>
          <p><strong>Lunch or days away:</strong> Use Block time. Existing cuts stay safe; move them first if there&apos;s a conflict.</p>
          <p><strong>Customer details:</strong> Find their name in Customers and tap Edit details. Private notes are just for you.</p>
          <p>Your shop needs an internet connection. Look for the saved confirmation before closing a form.</p>
        </div></details><Link className="studio-advanced-link" href="/admin/collections/appointments">Advanced administration</Link></aside>
    </div>
  </section>;
}

export function ServiceForm(props: TaskProps & { service: OwnerService }) {
  const [price, setPrice] = useState((props.service.priceCents / 100).toFixed(2));
  const [duration, setDuration] = useState(props.service.durationMinutes);
  const [buffer, setBuffer] = useState(props.service.bufferMinutes);
  const [active, setActive] = useState(props.service.active);
  const task = useStudioTask(props);
  async function save(event: FormEvent) {
    event.preventDefault();
    await task.run(async () => {
      await ownerAPI("services/save", { id: props.service.id, price, durationMinutes: duration, bufferMinutes: buffer, active });
      props.onSaved(`${props.service.name} updated. Existing visits keep their quoted price.`);
    });
  }
  return <form className="studio-stack" onSubmit={save} onChange={props.onDirty}><fieldset className="studio-stack" disabled={task.busy}>
    <label className="studio-label">Price in dollars<input className="studio-input" type="number" inputMode="decimal" min={0} max={99999.99} step={0.01} required value={price} onChange={(e) => setPrice(e.target.value)} /></label>
    <label className="studio-label">Time for the cut <span className="studio-muted">(minutes)</span><input className="studio-input" type="number" min={5} max={240} step={5} required value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
    <label className="studio-label">Extra cleanup time afterward <span className="studio-muted">(minutes)</span><input className="studio-input" type="number" min={0} max={60} step={5} required value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} /></label>
    <label className="studio-switch"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span><strong>Offer this service</strong><small>Turn off to stop new bookings without losing visit history.</small></span></label>
    <p className="studio-muted studio-small">Use 5-minute steps for cut and cleanup times. Price changes apply to new bookings, not visits already on the books.</p>
    <FormError message={task.error} /><button className="studio-button primary" type="submit">{task.busy ? "Saving service..." : "Save service"}</button>
  </fieldset></form>;
}
