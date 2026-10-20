"use client";

import { useState, type FormEvent } from "react";
import { ownerAPI } from "@/lib/owner-client";
import type { OwnerCustomer } from "@/lib/owner-types";
import { FormError, useStudioTask, type TaskProps } from "./shared";

export function CustomerForm(props: TaskProps & { customer?: OwnerCustomer }) {
  const [name, setName] = useState(props.customer?.name ?? "");
  const [phone, setPhone] = useState(props.customer?.phone ?? "");
  const [preferences, setPreferences] = useState(props.customer?.preferences ?? "");
  const task = useStudioTask(props);
  async function save(event: FormEvent) {
    event.preventDefault();
    await task.run(async () => {
      await ownerAPI("customers/save", { ...(props.customer ? { id: props.customer.id } : {}), name, phone, preferences });
      props.onSaved(props.customer ? "Customer details saved." : `${name.trim()} has been added to your ohana.`);
    });
  }
  return <form className="studio-stack" onSubmit={save} onChange={props.onDirty}><fieldset disabled={task.busy} className="studio-stack">
    <label className="studio-label">Customer name<input className="studio-input" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
    <label className="studio-label">Mobile phone<input className="studio-input" autoComplete="tel" type="tel" required maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(541) 555-0123" /></label>
    <p className="studio-muted studio-small">This number connects their visits and phone login. Changing it signs them out of existing devices so their account stays private.</p>
    <label className="studio-label">Notes just for you <span className="studio-muted">(optional)</span><textarea className="studio-input" rows={5} maxLength={2000} value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="Usual cut, clipper guard, or anything you'd like to remember..." /></label>
    <p className="studio-muted studio-small">Private notes stay in your shop. Customers don&apos;t see them.</p>
    <FormError message={task.error} />
    <button className="studio-button primary" type="submit">{task.busy ? "Saving customer..." : "Save customer"}</button>
  </fieldset></form>;
}
