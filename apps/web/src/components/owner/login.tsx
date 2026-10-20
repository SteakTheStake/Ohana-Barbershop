"use client";

import { useState, type FormEvent } from "react";
import { FormError, StudioIcon } from "./shared";

export function OwnerLogin({ onSignedIn, message }: { onSignedIn: () => void; message: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      if (!response.ok) throw new Error(response.status === 429 || response.status === 403 ? "Too many sign-in attempts. Wait a little before trying again." : "That email and password didn't match. Please try again.");
      setPassword(""); onSignedIn();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="studio-login">
    <div className="studio-login-story"><span className="studio-brand">OHANA <small>MY SHOP</small></span><p className="studio-kicker">Less admin. More aloha.</p><h1>Your day.<br /><span>Your chair.</span><br />All right here.</h1><p>Book a cut, take a break, and keep your ohana close. One simple place to run your shop.</p><div className="studio-login-features"><span><StudioIcon name="calendar" />Your daily schedule</span><span><StudioIcon name="people" />Your regulars, remembered</span></div></div>
    <form className="studio-login-card studio-stack" onSubmit={login}>
      <div><p className="studio-kicker">For the barber</p><h2>Welcome back.</h2><p className="studio-muted">Sign in to take care of your day.</p></div>
      {message && <p role="status" className="studio-muted">{message}</p>}
      <label className="studio-label">Email<input type="email" className="studio-input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="studio-label">Password<input type="password" className="studio-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <FormError message={error} />
      <button type="submit" className="studio-button primary" disabled={busy}>{busy ? "Signing you in..." : "Open my shop"}<StudioIcon name="arrow" /></button>
      <p className="studio-muted studio-small">This is your private owner workspace. Customers use <a href="/account">My Ohana</a> to manage their visits.</p>
    </form>
  </main>;
}
