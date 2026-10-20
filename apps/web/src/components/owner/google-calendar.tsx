"use client";

import { useEffect, useState } from "react";
import { ownerAPI } from "@/lib/owner-client";
import type { GoogleCalendarStatus } from "@/lib/google-calendar-state";

const labels = {
  disabled: "Not connected", initializing: "Waiting for the first successful sync", stale: "Sync is overdue",
  pending: "Saved changes are waiting to reach Google", error: "Google synchronization failed",
  conflict: "Scheduling conflicts need attention", healthy: "Connected and up to date",
};

export function GoogleCalendarPanel({ onAuthError }: { onAuthError: (error: unknown) => void }) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void ownerAPI<GoogleCalendarStatus>("calendar/google", undefined, ctrl.signal).then((result) => {
        if (!ctrl.signal.aborted) { setStatus(result); setError(""); }
      }).catch((e) => {
        if (!ctrl.signal.aborted) { setError("Couldn't check Google Calendar."); onAuthError(e); }
      });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { ctrl.abort(); window.clearInterval(timer); };
  }, [onAuthError]);
  async function sync() {
    setBusy(true); setError("");
    try {
      setStatus(await ownerAPI<GoogleCalendarStatus>("calendar/google/sync", {}));
    } catch (e) { setError("Couldn't sync Google Calendar. Try again; your saved visits are unchanged."); onAuthError(e); }
    finally { setBusy(false); }
  }
  return <section className="studio-panel studio-stack">
    <h2>Rosie &amp; Google Calendar</h2>
    <p className="studio-muted">{!status ? "Checking Google Calendar connection..." : status.enabled
      ? "Google bookings block your available times. Saved Ohana visits and breaks sync automatically, with scheduled recovery if a request fails."
      : "The Google Calendar bridge is not connected. Ask your website administrator to configure it before switching Rosie away from Acuity."}</p>
    {status?.enabled && <>
      <p className={status.healthy ? "studio-muted" : "studio-notice"} role={status.healthy ? "status" : "alert"}>
        <strong>{labels[status.state]}</strong>{!status.healthy && " / New Ohana bookings are paused until synchronization is healthy."}
      </p>
      <p className="studio-muted studio-small">{status.lastSync
        ? `Last successful sync: ${new Date(status.lastSync.syncedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific.`
        : "No successful sync yet."}</p>
      {status.failure && <p className="studio-muted studio-small">Last failure: {status.failure.code}. Automatic retry after {new Date(status.failure.nextRetryAt).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles" })} Pacific. Check Google credentials and calendar sharing if failures continue.</p>}
      {status.failure?.code === "database-binding" && <p role="alert">This calendar belongs to an unrecognized database. Restore the original full backup or configure a new calendar and namespace. Do not clear the binding to force adoption.</p>}
      {!!status.lastSync?.conflicts?.length && <div className="studio-stack">
        <strong>Resolve these overlaps before taking more bookings:</strong>
        <ul>{status.lastSync.conflicts.slice(0, 10).map((conflict) => <li key={`${conflict.recordKind}:${conflict.recordId}:${conflict.googleEventId}`}>
          {conflict.recordKind === "appointment" ? "Visit" : "Time off"} #{conflict.recordId} / {new Date(conflict.startsAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific overlaps a Google booking.
        </li>)}</ul>
        <p className="studio-muted studio-small">Check that date in Schedule. Move or cancel the appropriate booking in its original system; the next sync clears resolved conflicts. Never cancel both copies without checking with the customer.</p>
      </div>}
      <button type="button" className="studio-button secondary" disabled={busy} onClick={sync}>{busy ? "Syncing..." : "Sync Google Calendar now"}</button>
      <p className="studio-muted studio-small">{status.bookingMode === "calendar"
        ? "Direct Rosie calendar booking is enabled with acknowledged simultaneous-booking risk. Rosie can still book independently: pause it manually during an outage or conflict. Calendar conflict detection is not an atomic reservation."
        : "Recommended setup: Rosie texts the Ohana booking link, so every confirmed visit uses the same reservation system."} Edit Ohana visits here; manage external bookings in their original system.</p>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
