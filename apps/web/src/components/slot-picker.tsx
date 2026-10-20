"use client";

import { useMemo, useState } from "react";
import { addShopDays, dayButtonLabel, slotTime, todayInShop } from "@/lib/client-api";

const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" });

const PARTS = [
  { id: "morning", label: "Morning", includes: (hour: number) => hour < 11 },
  { id: "midday", label: "Midday", includes: (hour: number) => hour >= 11 && hour < 14 },
  { id: "afternoon", label: "Afternoon", includes: (hour: number) => hour >= 14 && hour < 17 },
  { id: "evening", label: "Evening", includes: (hour: number) => hour >= 17 },
];

export function upcomingShopDays(count: number) {
  const today = todayInShop();
  return Array.from({ length: Math.max(0, count) }, (_, i) => addShopDays(today, i));
}

export function DayPicker({ days, value, onChange }: { days: string[]; value: string; onChange: (date: string) => void }) {
  return (
    <div className="day-strip" role="group" aria-label="Choose a day">
      {days.map((day, i) => {
        const [weekday, date] = dayButtonLabel(day).split(", ");
        const name = i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday;
        return (
          <button key={day} type="button" aria-pressed={value === day} aria-label={`${name}, ${date}`}
            className={`day-choice ${value === day ? "is-selected" : ""}`} onClick={() => onChange(day)}>
            <span className="day-choice__name">{name}</span>
            <span className="day-choice__date">{date}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SlotPicker({ slots, value, onChange, loading, error, empty }: {
  slots: string[];
  value: string;
  onChange: (iso: string) => void;
  loading?: boolean;
  error?: string;
  empty?: string;
}) {
  const groups = useMemo(() => {
    const byPart = new Map<string, string[]>();
    for (const slot of slots) {
      const hour = Number(hourFormat.format(new Date(slot)));
      const part = PARTS.find((p) => p.includes(hour)) ?? PARTS[PARTS.length - 1];
      byPart.set(part.id, [...(byPart.get(part.id) ?? []), slot]);
    }
    return PARTS.filter((p) => byPart.has(p.id)).map((p) => ({ ...p, slots: byPart.get(p.id)! }));
  }, [slots]);
  const [part, setPart] = useState("");
  const active = groups.some((g) => g.id === part) ? part : (groups[0]?.id ?? "");
  const visible = groups.find((g) => g.id === active)?.slots ?? [];

  if (loading) return <p role="status" className="text-sand">Checking the chair...</p>;
  if (error) return <p role="alert" className="booking-error">{error}</p>;
  if (!slots.length) return <p className="text-sand">{empty ?? "No open times on this date. Try another day, or call us."}</p>;
  return (
    <div>
      <div className="daypart-tabs" role="group" aria-label="Time of day">
        {groups.map((group) => (
          <button key={group.id} type="button" aria-pressed={group.id === active}
            className={`daypart-tab ${group.id === active ? "is-selected" : ""}`} onClick={() => setPart(group.id)}>
            {group.label} <span className="daypart-tab__count">{group.slots.length}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {visible.map((slot) => (
          <button key={slot} type="button" aria-pressed={value === slot}
            className={`slot-choice ${value === slot ? "is-selected" : ""}`} onClick={() => onChange(slot)}>
            {slotTime(slot)}
          </button>
        ))}
      </div>
    </div>
  );
}
