"use client";

import { useState, type FormEvent } from "react";
import { api, type CustomerInfo } from "@/lib/client-api";

export function PhoneLogin({ onSignedIn }: { onSignedIn: (customer: CustomerInfo) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: number; developmentCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!challenge) {
        setChallenge(await api("auth/send", { phone }));
      } else {
        const result = await api<{ customer: CustomerInfo }>("auth/verify", { challengeId: challenge.challengeId, code, name });
        onSignedIn(result.customer);
      }
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="ohana-panel space-y-5">
      <div>
        <p className="booking-eyebrow">Your Ohana Account</p>
        <h2 className="font-display mt-2 text-3xl tracking-wide">Your number. Your next cut.</h2>
        <p className="text-sand mt-2 text-sm">Sign in or create an account with a one-time code. No password to remember.</p>
      </div>
      {!challenge ? (
        <label className="booking-label">Mobile phone
          <input className="booking-input" type="tel" autoComplete="tel" placeholder="(541) 555-0123" required maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      ) : (
        <>
          <p className="text-sm">Enter the code for <strong>{phone}</strong>. It expires in five minutes.</p>
          {challenge.developmentCode && <p className="rounded-md border border-ember bg-ember/10 p-3 text-sm">Development only - no text sent. Test code: <strong>{challenge.developmentCode}</strong></p>}
          <label className="booking-label">Your name
            <input className="booking-input" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="booking-label">Verification code
            <input className="booking-input tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button type="button" className="text-sand text-sm underline underline-offset-4" disabled={busy} onClick={() => { setChallenge(null); setCode(""); setError(""); }}>Change number or request a new code</button>
        </>
      )}
      {error && <p role="alert" className="booking-error">{error}</p>}
      <button className="booking-primary w-full" disabled={busy}>{busy ? "One moment..." : challenge ? "Verify & sign in" : "Text me a code"}</button>
      <p className="text-sand/70 text-xs leading-relaxed">By requesting a code, you agree to receive a verification text. Message and data rates may apply. Your phone number is used for your account and appointments, not marketing.</p>
    </form>
  );
}
