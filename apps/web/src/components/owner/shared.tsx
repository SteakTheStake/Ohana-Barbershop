"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { OwnerSessionExpired } from "@/lib/owner-client";
import { SaveUncertain } from "@/lib/save-client";

export function StudioIcon({ name }: { name: "calendar" | "people" | "shop" | "plus" | "break" | "arrow" | "check" }) {
  const paths = {
    calendar: "M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1zm3 9h2m4 0h2m-8 3h2",
    people: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.9M15 3.1a4 4 0 010 7.8M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    shop: "M3 10h18l-2-7H5l-2 7zm2 0v11h14V10M9 21v-7h6v7",
    plus: "M12 5v14M5 12h14",
    break: "M3 7h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V7zm14 1h2a3 3 0 010 6h-2M7 2v2m6-2v2",
    arrow: "M5 12h14m-6-6l6 6-6 6",
    check: "M5 12l4 4L19 6",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function StudioDialog({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="studio-dialog" aria-labelledby="studio-dialog-title" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="studio-dialog-inner">
      <div className="studio-dialog-head"><div><p className="studio-kicker">Ohana / My Shop</p><h2 id="studio-dialog-title">{title}</h2></div><button type="button" aria-label="Close form" className="studio-close" onClick={onClose} disabled={busy}>X</button></div>
      {children}
    </div>
  </dialog>;
}

export type TaskProps = {
  onSaved: (message: string, date?: string) => void;
  onAuthError: (error: unknown) => void;
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
};
export function useStudioTask(props: Pick<TaskProps, "onBusy" | "onAuthError">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<(() => Promise<void>) | null>(null);
  const running = useRef(false);
  async function run(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true); props.onBusy(true); setError("");
    try { await task(); setRecovery(null); }
    catch (error) {
      if (error instanceof OwnerSessionExpired) props.onAuthError(error);
      else {
        if (error instanceof SaveUncertain) setRecovery(() => task);
        else setRecovery(null);
        setError((error as Error).message);
      }
    } finally { running.current = false; setBusy(false); props.onBusy(false); }
  }
  return { busy, error, run, recovery, retry: () => recovery && run(recovery) };
}

export function FormError({ message }: { message: string }) {
  return message ? <p role="alert" className="studio-error">{message}</p> : null;
}
