"use client";

import { useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import { dayMove, localDate, localInput, localISO, nextBreakTime, OWNER_ZONE, ownerAPI, ownerToday } from "@/lib/owner-client";
import type { OwnerBlock } from "@/lib/owner-types";
import { FormError, useStudioTask, type TaskProps } from "./shared";

export function BlockForm(props: TaskProps & { date: string; block?: OwnerBlock }) {
  const { block } = props;
  const initialAllDay = !!block && localInput(block.startsAt) === "00:00" && localInput(block.endsAt) === "00:00";
  const [mode, setMode] = useState(initialAllDay ? "off" : "break");
  const [reason, setReason] = useState(block?.reason ?? "Break");
  const [startDate, setStartDate] = useState(block ? localDate(block.startsAt) : props.date);
  const [startTime, setStartTime] = useState(block ? localInput(block.startsAt) : props.date === ownerToday() ? nextBreakTime() : "09:00");
  const initialEnd = localISO(props.date, props.date === ownerToday() ? nextBreakTime() : "09:00");
  const [endDate, setEndDate] = useState(block ? dayMove(localDate(block.endsAt), initialAllDay ? -1 : 0) : DateTime.fromISO(initialEnd).setZone(OWNER_ZONE).plus({ minutes: 30 }).toISODate()!);
  const [endTime, setEndTime] = useState(block ? localInput(block.endsAt) : DateTime.fromISO(initialEnd).setZone(OWNER_ZONE).plus({ minutes: 30 }).toFormat("HH:mm"));
  const [duration, setDuration] = useState(block ? Math.round((Date.parse(block.endsAt) - Date.parse(block.startsAt)) / 60000) : 30);
  const task = useStudioTask(props);
  function quickEnd(date: string, time: string, minutes: number) {
    const end = DateTime.fromISO(`${date}T${time}`, { zone: OWNER_ZONE }).plus({ minutes });
    if (end.isValid) { setEndDate(end.toISODate()!); setEndTime(end.toFormat("HH:mm")); }
  }
  function chooseMode(value: string) {
    setMode(value); props.onDirty();
    if (!block && (reason === "Break" || reason === "Time off")) setReason(value === "off" ? "Time off" : "Break");
    if (!block && value === "off") setEndDate(startDate);
    if (value === "off" && endDate < startDate) setEndDate(startDate);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await task.run(async () => {
      const startsAt = localISO(startDate, mode === "off" ? "00:00" : startTime);
      const endsAt = mode === "off" ? localISO(dayMove(endDate, 1), "00:00") : localISO(endDate, endTime);
      await ownerAPI("time-off/save", { ...(block ? { id: block.id } : {}), reason, startsAt, endsAt });
      props.onSaved(block ? "Blocked time updated." : "Time blocked. Your chair is kept free.", startDate);
    });
  }
  async function remove() {
    if (!block || !window.confirm(`Remove "${block.reason}"? Customers will be able to book this time again, within your working hours.`)) return;
    await task.run(async () => { await ownerAPI("time-off/remove", { id: block.id }); props.onSaved("Blocked time removed. That time is open again."); });
  }
  return <form className="studio-stack" onSubmit={save} onChange={props.onDirty}>
    <fieldset className="studio-stack" disabled={task.busy}>
      <p className="studio-muted">Keep your chair free for lunch, a day away, or a well-earned vacation. This won&apos;t cancel existing cuts.</p>
      <div className="studio-segment" aria-label="Type of blocked time"><button type="button" aria-pressed={mode === "break"} onClick={() => chooseMode("break")}>A break</button><button type="button" aria-pressed={mode === "off"} onClick={() => chooseMode("off")}>Time off / days away</button></div>
      <label className="studio-label">What is this time for?<input className="studio-input" value={reason} required minLength={2} maxLength={100} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="studio-field-grid">
        <label className="studio-label">{mode === "off" ? "First day away" : "Start date"}<input className="studio-input" type="date" required value={startDate} onChange={(e) => { setStartDate(e.target.value); if (mode === "break" && duration) quickEnd(e.target.value, startTime, duration); else if (endDate < e.target.value) setEndDate(e.target.value); }} /></label>
        {mode === "break" && <label className="studio-label">Start time<input className="studio-input" type="time" required value={startTime} onChange={(e) => { setStartTime(e.target.value); if (duration) quickEnd(startDate, e.target.value, duration); }} /></label>}
      </div>
      {mode === "break" && <div><p className="studio-label">How long?</p><div className="studio-duration-choices">{[15, 30, 45, 60].map((m) => <button className="studio-time-choice" aria-pressed={duration === m} type="button" key={m} onClick={() => { setDuration(m); quickEnd(startDate, startTime, m); props.onDirty(); }}>{m === 60 ? "1 hour" : `${m} min`}</button>)}</div></div>}
      <div className="studio-field-grid">
        <label className="studio-label">{mode === "off" ? "Last day away (included)" : "End date"}<input className="studio-input" type="date" required min={startDate} max={dayMove(startDate, 30)} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        {mode === "break" && <label className="studio-label">End time<input className="studio-input" type="time" required value={endTime} onChange={(e) => { setEndTime(e.target.value); setDuration(0); }} /></label>}
      </div>
      <p className="studio-muted studio-small">{mode === "off" ? "Every day in this range is blocked, including the first and last day. Up to 31 days at once." : "Times are Pacific. Adjust the end time if you need a different length."} If a cut is already booked, we&apos;ll ask you to move it first.</p>
      <FormError message={task.error} />
      {task.busy && mode === "off" && <p className="studio-muted" role="status">Reserving your days away. Longer time off can take a few seconds; keep this screen open.</p>}
      <button className="studio-button primary" type="submit">{task.busy ? "Blocking time..." : block ? "Save blocked time" : "Block this time"}</button>
      {block && <button className="studio-text-button danger" type="button" onClick={remove}>Remove this blocked time</button>}
    </fieldset>
  </form>;
}
