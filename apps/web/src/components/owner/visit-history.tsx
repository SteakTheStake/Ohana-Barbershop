"use client";

import { useState } from "react";
import { ownerAPI } from "@/lib/owner-client";

type Entry = {
  id: number; actor: string; action: string; createdAt: string;
  after: { startsAt: string; status: string; revision: number };
};

export function VisitHistory({ id, onAuthError }: { id: number; onAuthError: (error: unknown) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try { setEntries((await ownerAPI<{ history: Entry[] }>(`appointments/history?id=${id}`)).history); }
    catch (error) { onAuthError(error); setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="studio-policy" onToggle={(e) => { if (e.currentTarget.open && !entries && !busy) void load(); }}>
    <summary>Visit history</summary>
    {busy && <p role="status">Loading history...</p>}
    {error && <p role="alert">{error}<button type="button" className="studio-text-button" onClick={load}>Try again</button></p>}
    {entries && !entries.length && <p className="studio-muted studio-small">History starts with changes made after the reliability update.</p>}
    <ol className="studio-calendar-steps studio-small">{entries?.map((entry) => <li key={entry.id}>
      {new Date(entry.createdAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific / {entry.actor} / {entry.action} / {entry.after.status} / revision {entry.after.revision}
      <span> / Visit: {new Date(entry.after.startsAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific</span>
    </li>)}</ol>
  </details>;
}
