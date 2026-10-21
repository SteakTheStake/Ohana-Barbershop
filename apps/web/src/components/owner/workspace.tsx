"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ownerAPI, OwnerSessionExpired, ownerToday } from "@/lib/owner-client";
import type { OwnerBlock, OwnerCustomer, OwnerDay, OwnerService, OwnerVisit } from "@/lib/owner-types";
import { OwnerLogin } from "./login";
import { Schedule } from "./schedule";
import { Customers } from "./customers";
import { Shop, ServiceForm } from "./shop";
import { BookingForm } from "./booking-form";
import { BlockForm } from "./block-form";
import { CustomerForm } from "./customer-form";
import { StudioDialog, StudioIcon } from "./shared";
import { useSaveRequest } from "@/lib/save-client";

type Panel = { kind: "visit"; visit?: OwnerVisit; customer?: OwnerCustomer } | { kind: "block"; block?: OwnerBlock } | { kind: "customer"; customer?: OwnerCustomer } | { kind: "service"; service: OwnerService };
export function OwnerWorkspace() {
  const [owner, setOwner] = useState<{ name: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState<"schedule" | "customers" | "shop">("schedule");
  const [date, setDate] = useState(ownerToday);
  const [data, setData] = useState<OwnerDay | null>(null);
  const [loadedDate, setLoadedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [dirty, setDirty] = useState(false);
  const [shopDirty, setShopDirty] = useState(false);
  const [shopVersion, setShopVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const statusRequest = useSaveRequest();
  const [online, setOnline] = useState(true);
  const [refreshFailed, setRefreshFailed] = useState(false);
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) setRefresh((n) => n + 1); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const authError = useCallback((error: unknown) => {
    if (error instanceof OwnerSessionExpired) {
      if (demo) { window.location.assign("/demo?next=%2Fowner"); return; }
      setOwner(null); setData(null); setPanel(null); setDirty(false); setShopDirty(false);
      setMessage(error.message);
    }
  }, [demo]);
  const checkSession = useCallback(async () => {
    setChecking(true); setError("");
    try {
      const result = await ownerAPI<{ owner: { name: string; email: string }; demo?: boolean }>("session");
      setDemo(result.demo === true);
      setOwner(result.owner); setMessage("");
    } catch (e) {
      if (!(e instanceof OwnerSessionExpired)) setError("We couldn't connect to your shop. Check your connection and try again.");
    } finally { setChecking(false); }
  }, []);
  useEffect(() => { void checkSession(); }, [checkSession]);
  useEffect(() => {
    if (!owner || demo) return;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/users/refresh-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (response.status === 401 || response.status === 403) authError(new OwnerSessionExpired("Please sign in again, then check your schedule before retrying."));
      } catch { /* A temporary connection failure is handled by the next shop request. */ }
    }, 45 * 60_000);
    return () => window.clearInterval(timer);
  }, [owner, demo, authError]);
  useEffect(() => {
    if (!owner) return;
    const ctrl = new AbortController();
    setLoading(true);
    ownerAPI<OwnerDay>(`day?date=${date}`, undefined, ctrl.signal)
      .then((result) => { setData(result); setLoadedDate(date); setError(""); setRefreshFailed(false); })
      .catch((e) => { if (!ctrl.signal.aborted) { authError(e); setError(e.message); setRefreshFailed(true); } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [owner, date, refresh, authError]);
  useEffect(() => {
    const refreshIfIdle = () => {
      setNow(Date.now());
      if (owner && !panel && !busy && view === "schedule" && document.visibilityState === "visible") setRefresh((n) => n + 1);
    };
    const timer = window.setInterval(refreshIfIdle, 60_000);
    window.addEventListener("focus", refreshIfIdle);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshIfIdle); };
  }, [owner, panel, busy, view]);
  useEffect(() => {
    if (!dirty && !shopDirty) return;
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, shopDirty]);
  function discardShop() {
    if (!shopDirty) return true;
    if (!window.confirm("Leave without saving your shop settings?")) return false;
    setShopDirty(false); setShopVersion((v) => v + 1); return true;
  }
  function open(next: Panel) {
    if (busy || dirty && !window.confirm("Leave this form without saving?") || !discardShop()) return;
    setDirty(false); setPanel(next); setMessage(""); setError("");
  }
  function close() {
    if (busy || dirty && !window.confirm("Leave this form without saving?")) return;
    setDirty(false); setPanel(null);
  }
  function saved(text: string, newDate?: string) {
    setDirty(false); setShopDirty(false); setPanel(null); setMessage(text); setError("");
    if (newDate) { setDate(newDate); setView("schedule"); }
    setRefresh((n) => n + 1);
  }
  async function status(visit: OwnerVisit, next: OwnerVisit["status"]) {
    setBusy(true); setError("");
    try { await ownerAPI("appointments/status", statusRequest({ id: visit.id, revision: visit.revision, status: next })); saved(next === "completed" ? `${visit.customer.name}'s cut is marked done. Mahalo!` : "Visit is back on the schedule."); }
    catch (e) { authError(e); setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (busy || dirty && !window.confirm("Sign out without saving this form?") || !discardShop()) return;
    if (demo) {
      const form = document.createElement("form");
      form.method = "post"; form.action = "/api/demo/logout";
      document.body.append(form); form.submit();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/users/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok && response.status !== 401 && response.status !== 400) throw new Error("We couldn't sign you out. Please try again.");
      setOwner(null); setData(null); setPanel(null); setDirty(false); setView("schedule"); setMessage("You're signed out.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const taskProps = { onSaved: saved, onAuthError: authError, onDirty: () => setDirty(true), onBusy: setBusy };
  if (checking) return <main className="studio-loading" role="status">Opening your shop...</main>;
  if (!owner) return <><OwnerLogin onSignedIn={checkSession} message={message} />{error && <div className="studio-login-retry"><p role="alert">{error}</p><button className="studio-button secondary" onClick={checkSession}>Try connecting again</button></div>}</>;
  return <div className="studio-shell">
    <header className="studio-header"><a href="/owner" className="studio-brand" aria-label="Ohana My Shop"><Image src="/small-logo.png" width={30} height={30} alt="" /><span>OHANA <small>MY SHOP</small></span></a><div><span className="studio-owner-name">Aloha, {owner.name}</span><button className="studio-button quiet" disabled={busy} onClick={logout}>{demo ? "Lock demo" : "Sign out"}</button></div></header>
    <main className="studio-main">
      {demo && <div className="studio-notice" role="status"><strong>Private demo / unfinished product</strong><p>Add customers and try appointments freely using fictional details. Changes are shared demo records, not real bookings. SMS and Google Calendar are disabled. <a href="/">View website</a></p></div>}
      {(!online || refreshFailed || data && now - Date.parse(data.updatedAt) > 180_000) && <div className="studio-notice" role="alert"><strong>{!online ? "You're offline." : "Your schedule may be out of date."}</strong><p>Showing the last loaded schedule. Reconnect and refresh before relying on open times. Unsaved changes are not queued offline.</p></div>}
      {message && <div className="studio-flash" role="status"><StudioIcon name="check" /><span>{message}</span><button className="studio-close" aria-label="Dismiss message" onClick={() => setMessage("")}>X</button></div>}
      {error && <div className="studio-error" role="alert">{error}<button className="studio-button quiet" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Try again</button></div>}
      {!data || loadedDate !== date ? <div className="studio-loading" role="status">Getting your schedule ready...</div> : <>
        {view === "schedule" && <Schedule date={date} data={data} now={now} loading={loading} busy={busy || loading} onDate={setDate} onRefresh={() => setRefresh((n) => n + 1)} onBook={() => open({ kind: "visit" })} onBlock={() => open({ kind: "block" })} onVisit={(visit) => open({ kind: "visit", visit })} onEditBlock={(block) => open({ kind: "block", block })} onStatus={status} onShop={() => setView("shop")} />}
        {view === "customers" && <Customers refresh={refresh} onEdit={(customer) => open({ kind: "customer", customer })} onBook={(customer) => open({ kind: "visit", customer })} onAuthError={authError} />}
        {view === "shop" && <Shop key={shopVersion} settings={data.settings} services={data.services} onEditService={(service) => open({ kind: "service", service })} onSaved={saved} onDirty={() => setShopDirty(true)} onBusy={setBusy} onAuthError={authError} />}
      </>}
    </main>
    <nav className="studio-nav" aria-label="Shop navigation">{([{ id: "schedule", label: "Schedule", icon: "calendar" }, { id: "customers", label: "Customers", icon: "people" }, { id: "shop", label: "Shop", icon: "shop" }] as const).map((tab) => <button key={tab.id} disabled={busy} aria-current={view === tab.id ? "page" : undefined} onClick={() => { if (view !== tab.id && discardShop()) { setView(tab.id); setError(""); } }}><StudioIcon name={tab.icon} /><span>{tab.label}</span></button>)}</nav>
    {panel && data && <StudioDialog title={panel.kind === "visit" ? panel.visit ? "Edit visit" : "Book a cut" : panel.kind === "block" ? panel.block ? "Edit blocked time" : "Make time for yourself" : panel.kind === "customer" ? panel.customer ? "Customer details" : "Add to your ohana" : panel.service.name} onClose={close} busy={busy}>
      {panel.kind === "visit" && <BookingForm key={`${panel.visit?.id ?? "new"}-${panel.customer?.id ?? "none"}`} {...taskProps} visit={panel.visit} customer={panel.customer} date={date} services={data.services} onEditCustomer={(customer) => open({ kind: "customer", customer })} onBookAgain={(customer) => open({ kind: "visit", customer })} />}
      {panel.kind === "block" && <BlockForm {...taskProps} block={panel.block} date={date} />}
      {panel.kind === "customer" && <CustomerForm {...taskProps} customer={panel.customer} />}
      {panel.kind === "service" && <ServiceForm {...taskProps} service={panel.service} />}
    </StudioDialog>}
  </div>;
}
