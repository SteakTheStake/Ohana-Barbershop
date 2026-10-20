"use client";

import { dayLabel, dayMove, localDate, localInput, localTime, ownerToday, statusLabel } from "@/lib/owner-client";
import { money } from "@/lib/client-api";
import type { OwnerBlock, OwnerDay, OwnerVisit } from "@/lib/owner-types";
import { StudioIcon } from "./shared";

type Props = {
  date: string; data: OwnerDay; loading: boolean; busy: boolean; now: number;
  onDate: (date: string) => void; onBook: () => void; onBlock: () => void; onRefresh: () => void;
  onVisit: (visit: OwnerVisit) => void; onEditBlock: (block: OwnerBlock) => void;
  onShop: () => void;
  onStatus: (visit: OwnerVisit, status: OwnerVisit["status"]) => void;
};
export function Schedule(props: Props) {
  const { data, date } = props;
  const live = data.appointments.filter((a) => a.status !== "cancelled");
  const next = live.find((a) => a.status === "confirmed" && Date.parse(a.endsAt) > props.now);
  const done = live.filter((a) => a.status === "completed").length;
  const cancelled = data.appointments.filter((a) => a.status === "cancelled");
  const timeline = [
    ...live.map((visit) => ({ type: "visit" as const, startsAt: visit.startsAt, visit })),
    ...data.blocks.map((block) => ({ type: "block" as const, startsAt: block.startsAt, block })),
    ...(data.externalEvents ?? []).map((event) => ({ type: "external" as const, startsAt: event.startsAt, event })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return <div className="studio-schedule-grid">
    <section>
      <div className="studio-day-bar">
        <div><p className="studio-kicker">{date === ownerToday() ? "Today at the shop" : "Your schedule"}</p><h1>{dayLabel(date)}</h1><p className="studio-muted">{live.length} {live.length === 1 ? "cut" : "cuts"} scheduled <span aria-hidden="true">/</span> {done} done</p></div>
        <button className="studio-button quiet" disabled={props.loading || props.busy} onClick={props.onRefresh}>{props.loading ? "Refreshing..." : "Refresh"}</button>
        <button className="studio-button quiet studio-print-button" disabled={props.loading || props.busy} onClick={() => window.print()}>Print day</button>
      </div>
      <div className="studio-date-nav">
        <button className="studio-button quiet" aria-label="Previous day" disabled={props.loading} onClick={() => props.onDate(dayMove(date, -1))}>&lt;</button>
        <label className="studio-date-label"><span className="studio-sr-only">Schedule date</span><input type="date" value={date} onChange={(e) => { if (e.target.value) props.onDate(e.target.value); }} /></label>
        <button className="studio-button quiet" aria-label="Next day" disabled={props.loading} onClick={() => props.onDate(dayMove(date, 1))}>&gt;</button>
        <button className="studio-button quiet" disabled={date === ownerToday()} onClick={() => props.onDate(ownerToday())}>Today</button>
      </div>
      {!data.settings.weeklyHours?.some((h) => !h.closed) ? <div className="studio-notice"><strong>Let&apos;s set up your working hours.</strong><p>You can add customers and block time now. Set your open days before scheduling cuts.</p><button className="studio-text-button" onClick={props.onShop}>Set working hours</button></div> : !data.settings.bookingEnabled && <div className="studio-notice studio-pause-notice"><span><strong>Online booking paused</strong><small>You can still book cuts here.</small></span><button className="studio-text-button" onClick={props.onShop}>Booking settings</button></div>}
      <div className="studio-timeline" aria-busy={props.loading}>
        {data.calendarWarning && <div className="studio-notice" role="alert">{data.calendarWarning}</div>}
        {!timeline.length && <div className="studio-empty"><StudioIcon name="calendar" /><h2>A little room to breathe.</h2><p>No cuts or breaks scheduled on this day.</p><button className="studio-button primary" onClick={props.onBook}>Book a cut<StudioIcon name="plus" /></button></div>}
        {timeline.map((item) => item.type === "external" ? (
          <article key={`g${item.event.id}`} className="studio-block-row">
            <span className="studio-time">{localTime(item.event.startsAt)}</span>
            <div className="studio-block-card"><StudioIcon name="calendar" /><span><strong>{item.event.title}</strong><small>Google Calendar / until {localTime(item.event.endsAt)}. Manage in Rosie or Google Calendar.</small></span></div>
          </article>
        ) : item.type === "block" ? (
          <article key={`b${item.block.id}`} className="studio-block-row">
            <span className="studio-time">{localInput(item.block.startsAt) === "00:00" && localInput(item.block.endsAt) === "00:00" ? "All day" : localTime(item.block.startsAt)}</span>
            <button className="studio-block-card" onClick={() => props.onEditBlock(item.block)} disabled={props.busy}><StudioIcon name="break" /><span><strong>{item.block.reason}</strong><small>{localInput(item.block.startsAt) === "00:00" && localInput(item.block.endsAt) === "00:00" ? `All day / through ${dayLabel(dayMove(localDate(item.block.endsAt), -1))}` : `Time blocked until ${localTime(item.block.endsAt)}${localDate(item.block.startsAt) !== localDate(item.block.endsAt) ? ` on ${dayLabel(localDate(item.block.endsAt))}` : ""}`}</small></span><span className="studio-edit-hint">Edit</span></button>
          </article>
        ) : <article key={`v${item.visit.id}`} className={`studio-visit-row ${item.visit.status === "completed" ? "is-done" : ""}`}>
          <span className="studio-time">{localTime(item.visit.startsAt)}</span>
          <div className={`studio-visit-card ${next?.id === item.visit.id ? "is-next" : ""}`}>
            <button className="studio-visit-main" disabled={props.busy} onClick={() => props.onVisit(item.visit)}>
              <span className="studio-visit-heading"><strong>{item.visit.customer.name}</strong><span className={`studio-badge ${item.visit.status}`}>{next?.id === item.visit.id ? Date.parse(item.visit.startsAt) <= props.now ? "In chair" : "Up next" : statusLabel[item.visit.status]}</span></span>
              <span className="studio-muted">{item.visit.serviceName} <span aria-hidden="true">/</span> {money(item.visit.priceCents)}</span>
              <span className="studio-small studio-muted">Until {localTime(item.visit.endsAt)}{item.visit.notes ? ` / ${item.visit.notes}` : ""}</span>
              <span className="studio-print-only">Phone: {item.visit.customer.phone}</span>
              <span className="studio-edit-hint">Tap to edit visit</span>
            </button>
            <div className="studio-visit-actions">
              <a className="studio-button quiet" href={`tel:${item.visit.customer.phone}`}>Call</a>
              {item.visit.status === "confirmed" && <button className="studio-button success" disabled={props.busy} onClick={() => props.onStatus(item.visit, "completed")}><StudioIcon name="check" />Done</button>}
              {item.visit.status === "completed" && <button className="studio-button quiet" disabled={props.busy} onClick={() => props.onStatus(item.visit, "confirmed")}>Undo done</button>}
              {item.visit.status === "no-show" && <button className="studio-button quiet" disabled={props.busy} onClick={() => props.onStatus(item.visit, "confirmed")}>Undo missed</button>}
            </div>
          </div>
        </article>)}
      </div>
      {!!cancelled.length && <details className="studio-cancelled"><summary>{cancelled.length} cancelled {cancelled.length === 1 ? "visit" : "visits"}</summary>{cancelled.map((a) => <div key={a.id}><span>{localTime(a.startsAt)} / {a.customer.name}</span><button className="studio-button quiet" disabled={props.busy} onClick={() => props.onVisit(a)}>View visit</button></div>)}</details>}
      <p className="studio-muted studio-small studio-sync">All times are Pacific time in Albany. Updated {localTime(data.updatedAt)}. Printed schedules are private snapshots; keep them secure and check for later changes.</p>
    </section>
    <aside className="studio-quick-actions">
      <div className="studio-panel"><p className="studio-kicker">Between customers</p><h2>Make a little time.</h2><p className="studio-muted">Your everyday tasks, one tap away.</p><button className="studio-button primary" onClick={props.onBook} disabled={props.busy}><StudioIcon name="plus" />Book a cut</button><button className="studio-button secondary" onClick={props.onBlock} disabled={props.busy}><StudioIcon name="break" />Block time</button></div>
      <div className="studio-tip"><strong>A quick tip</strong><p>Tap any visit to move its time, change the cut, or add a note. Tap a break to change or remove it.</p></div>
      <div className="studio-mobile-actions"><button className="studio-button primary" onClick={props.onBook} disabled={props.busy}><StudioIcon name="plus" />Book a cut</button><button className="studio-button secondary" onClick={props.onBlock} disabled={props.busy}><StudioIcon name="break" />Block time</button></div>
    </aside>
  </div>;
}
