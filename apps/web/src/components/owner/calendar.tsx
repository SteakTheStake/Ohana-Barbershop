"use client";

import { useEffect, useRef, useState } from "react";
import { ownerAPI, OwnerSessionExpired } from "@/lib/owner-client";

export function CalendarPanel(props: { onAuthError: (error: unknown) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function load(signal?: AbortSignal) {
    setError("");
    try { setUrl((await ownerAPI<{ url: string }>("calendar", undefined, signal)).url); }
    catch (e) {
      if (signal?.aborted) return;
      if (e instanceof OwnerSessionExpired) props.onAuthError(e);
      else setError((e as Error).message);
    }
  }
  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 5000);
    } catch { input.current?.select(); }
  }
  async function reset() {
    if (!window.confirm("Get a new calendar link? Your old link stops working, so remove the old calendar in Google Calendar and add the new link.")) return;
    setBusy(true); setError("");
    try { setUrl((await ownerAPI<{ url: string }>("calendar/reset", {})).url); setCopied(false); }
    catch (e) {
      if (e instanceof OwnerSessionExpired) props.onAuthError(e);
      else setError((e as Error).message);
    } finally { setBusy(false); }
  }
  const local = url ? /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname) : false;
  return <section className="studio-panel studio-stack">
    <div><h2>Read-only calendar subscription</h2><p className="studio-muted">See every Ohana cut on your phone&apos;s calendar. This optional subscription is separate from the Rosie bridge and may display duplicate entries if you use both.</p></div>
    <p className="studio-notice">Your Schedule here is the source of truth for Ohana visits. This subscription may take hours or longer to refresh. Change Ohana visits here, not in Google. Rotating a link stops future access but cannot erase copies already downloaded.</p>
    {error ? <p role="alert" className="studio-error">{error}<button type="button" className="studio-text-button" onClick={() => void load()}>Try again</button></p>
      : !url ? <p className="studio-muted" role="status">Getting your calendar link...</p> : <>
        <label className="studio-label">Your private calendar link <span className="studio-muted">(treat it like a password)</span>
          <input ref={input} className="studio-input" readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
        <div className="studio-calendar-actions">
          <button type="button" className="studio-button secondary" onClick={copy} disabled={busy}>{copied ? "Link copied!" : "Copy calendar link"}</button>
          <button type="button" className="studio-text-button" onClick={reset} disabled={busy}>Get a new link</button>
        </div>
        {local && <p className="studio-muted studio-small">This link points at this computer for now. It starts working for Google once your shop is live on the internet.</p>}
        <details><summary className="studio-calendar-help">How to add it in Google Calendar</summary><div className="studio-stack">
          <ol className="studio-muted studio-small studio-calendar-steps">
            <li>Copy your link above.</li>
            <li>Open Google Calendar on the web in your browser.</li>
            <li>Next to <strong>Other calendars</strong>, tap <strong>+</strong> and choose <strong>From URL</strong>.</li>
            <li>Paste your link and tap <strong>Add calendar</strong>. It shows up in the phone app too.</li>
          </ol>
          <p className="studio-muted studio-small">Google controls refresh timing; it is not real-time. Manual Add to Google Calendar creates an independent copy that will not follow later moves or cancellations, and may duplicate subscribed events. The subscription link also works with Apple Calendar and Outlook.</p>
        </div></details>
      </>}
  </section>;
}
