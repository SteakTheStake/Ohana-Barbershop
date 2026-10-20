"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ownerAPI, dayMove, localDate, localTime, ownerToday } from "@/lib/owner-client";
import { money } from "@/lib/client-api";
import { googleEventUrl } from "@/lib/calendar";
import { useSaveRequest } from "@/lib/save-client";
import { VisitHistory } from "./visit-history";
import type { OwnerCustomer, OwnerService, OwnerVisit } from "@/lib/owner-types";
import { CustomerPicker } from "./customer-picker";
import { FormError, useStudioTask, type TaskProps } from "./shared";

type Props = TaskProps & {
  visit?: OwnerVisit; customer?: OwnerCustomer; services: OwnerService[]; date: string;
  onEditCustomer: (customer: OwnerCustomer) => void; onBookAgain: (customer: OwnerCustomer) => void;
};
export function BookingForm(props: Props) {
  const { visit, onAuthError } = props;
  const [customer, setCustomer] = useState(visit?.customer ?? props.customer ?? null);
  const [mode, setMode] = useState<"find" | "new">("find");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(String(visit?.serviceId ?? props.services.find((s) => s.active)?.id ?? ""));
  const [date, setDate] = useState(visit ? localDate(visit.startsAt) : props.date < ownerToday() ? ownerToday() : props.date);
  const [startsAt, setStartsAt] = useState(visit?.startsAt ?? "");
  const [notes, setNotes] = useState(visit?.notes ?? "");
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const task = useStudioTask(props);
  const saveRequest = useSaveRequest();
  const statusRequest = useSaveRequest();
  const selectedService = props.services.find((s) => String(s.id) === serviceId);

  useEffect(() => {
    if (!serviceId || !date || visit?.status === "cancelled") return;
    const ctrl = new AbortController();
    setLoading(true); setSlotError(""); setSlots([]);
    ownerAPI<{ slots: string[] }>(`availability?service=${serviceId}&date=${date}${visit ? `&appointment=${visit.id}` : ""}`, undefined, ctrl.signal)
      .then((result) => setSlots(result.slots))
      .catch((e) => { if (!ctrl.signal.aborted) { setSlotError(e.message); onAuthError(e); } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [serviceId, date, visit, onAuthError]);

  const canKeepTime = visit && visit.serviceId === Number(serviceId) && localDate(visit.startsAt) === date && !slots.some((s) => Date.parse(s) === Date.parse(visit.startsAt));
  async function save(event: FormEvent) {
    event.preventDefault();
    const data = saveRequest({
      ...(visit ? { id: visit.id, revision: visit.revision } : {}), serviceId: Number(serviceId), startsAt, notes,
      ...(customer ? { customerId: customer.id } : { newCustomer: { name, phone } }),
    });
    await task.run(async () => {
      const result = await ownerAPI<{ appointment: OwnerVisit }>("appointments/save", data);
      props.onSaved(visit ? "Visit updated. You're all set." : `${result.appointment.customer.name} is on the books.`, localDate(result.appointment.startsAt));
    });
  }
  if (task.recovery) return <div className="studio-stack">
    <h3>Check the last save before changing anything</h3>
    <FormError message={task.error} />
    <p className="studio-muted">Your original details are kept in this open form. Check again using the same save ID; a successful save will not be duplicated. Do not start a new booking until you know the outcome.</p>
    <button type="button" className="studio-button primary" disabled={task.busy} onClick={() => void task.retry()}>{task.busy ? "Checking saved visit..." : "Check saved visit safely"}</button>
  </div>;
  async function changeStatus(status: OwnerVisit["status"]) {
    if (!visit) return;
    if (status === "cancelled" && !window.confirm(`Cancel ${visit.customer.name}'s ${visit.serviceName} at ${localTime(visit.startsAt)}? This time will become available again.`)) return;
    await task.run(async () => {
      await ownerAPI("appointments/status", statusRequest({ id: visit.id, revision: visit.revision, status }));
      props.onSaved(status === "cancelled" ? "Visit cancelled. That time is open again." : "Visit marked as missed.");
    });
  }
  if (visit?.status === "cancelled") return <div className="studio-stack"><p className="studio-notice">This visit was cancelled. Its time is no longer reserved.</p><h3>{visit.customer.name}</h3><p>{visit.serviceName} / {localTime(visit.startsAt)}</p><button className="studio-button primary" onClick={() => props.onBookAgain(visit.customer)}>Book another cut</button><button className="studio-button secondary" onClick={() => props.onEditCustomer(visit.customer)}>Edit customer details</button></div>;
  return <form className="studio-stack" onSubmit={save} onChange={props.onDirty}>
    <fieldset disabled={task.busy} className="studio-stack">
      <div><p className="studio-form-step">1 / Who&apos;s coming in?</p>
        {customer ? <div className="studio-selected-customer"><strong>{customer.name}</strong><span>{customer.phone}</span><div><button type="button" className="studio-text-button" onClick={() => { setCustomer(null); props.onDirty(); }}>Choose someone else</button><button type="button" className="studio-text-button" onClick={() => props.onEditCustomer(customer)}>Edit customer details</button></div></div> : <>
          <div className="studio-segment" aria-label="Choose customer type"><button type="button" aria-pressed={mode === "find"} onClick={() => { setMode("find"); props.onDirty(); }}>Find customer</button><button type="button" aria-pressed={mode === "new"} onClick={() => { setMode("new"); props.onDirty(); }}>New customer</button></div>
          {mode === "find" ? <CustomerPicker onSelect={(c) => { setCustomer(c); props.onDirty(); }} onAuthError={props.onAuthError} /> : <div className="studio-field-grid"><label className="studio-label">Customer name<input className="studio-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} /></label><label className="studio-label">Mobile phone<input className="studio-input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={40} placeholder="(541) 555-0123" /></label></div>}
        </>}
      </div>
      <div className="studio-stack"><p className="studio-form-step">2 / Choose the cut & time</p>
        <label className="studio-label">Service<select className="studio-input" required value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStartsAt(""); }}>
          <option value="" disabled>Choose a service</option>{props.services.filter((s) => s.active || s.id === visit?.serviceId).map((s) => <option key={s.id} value={s.id}>{s.name} / {s.durationMinutes} min / {money(s.priceCents)}{s.active ? "" : " (not currently offered)"}</option>)}
        </select></label>
        <label className="studio-label">Visit date<input className="studio-input" type="date" required min={visit ? undefined : ownerToday()} max={dayMove(ownerToday(), 365)} value={date} onChange={(e) => { setDate(e.target.value); setStartsAt(""); }} /></label>
        <div><p className="studio-label">Open times <span className="studio-muted">(Pacific)</span></p><div className="studio-time-grid" aria-live="polite">
          {loading ? <p className="studio-muted">Finding open times...</p> : <>
            {canKeepTime && <button type="button" className="studio-time-choice" aria-pressed={Date.parse(startsAt) === Date.parse(visit.startsAt)} onClick={() => { setStartsAt(visit.startsAt); props.onDirty(); }}>{localTime(visit.startsAt)} <small>Current time</small></button>}
            {slots.map((s) => <button type="button" key={s} className="studio-time-choice" aria-pressed={Date.parse(startsAt) === Date.parse(s)} onClick={() => { setStartsAt(s); props.onDirty(); }}>{localTime(s)}</button>)}
          </>}
        </div><FormError message={slotError} />{!loading && !slotError && !slots.length && <p className="studio-muted studio-small">No other openings on this date. Try another day, or check your working hours in Shop. Existing visits can keep their current time.</p>}</div>
      </div>
      <label className="studio-label">Visit notes <span className="studio-muted">(optional, visible to the customer)</span><textarea className="studio-input" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything special for this cut?" /></label>
      {selectedService && <div className="studio-save-summary"><strong>{selectedService.name}</strong><span>{selectedService.durationMinutes} minutes / {money(visit && visit.serviceId === selectedService.id ? visit.priceCents : selectedService.priceCents)} / Pay at the shop</span>{startsAt && <span>{localTime(startsAt)} / {date}</span>}</div>}
      <FormError message={task.error} />
      {visit && <VisitHistory id={visit.id} onAuthError={props.onAuthError} />}
      {visit && <p className="studio-muted studio-small">Google manual adds are separate copies: later edits and cancellations do not update them. Skip manual adds if you already subscribe, to avoid duplicates.</p>}
      <button type="submit" className="studio-button primary" disabled={loading || !startsAt || !serviceId || !customer && mode !== "new"}>{task.busy ? "Saving your visit..." : visit ? "Save visit changes" : "Book this cut"}</button>
      {visit?.status === "confirmed" && <div className="studio-form-alternatives"><a className="studio-text-button" href={googleEventUrl(visit)} target="_blank" rel="noreferrer">Add to Google Calendar</a><button type="button" className="studio-text-button" onClick={() => changeStatus("no-show")}>Customer didn&apos;t arrive</button><button type="button" className="studio-text-button danger" onClick={() => changeStatus("cancelled")}>Cancel this visit</button></div>}
    </fieldset>
  </form>;
}
