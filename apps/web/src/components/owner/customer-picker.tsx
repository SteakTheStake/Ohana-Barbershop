"use client";

import { useEffect, useState } from "react";
import { ownerAPI } from "@/lib/owner-client";
import type { CustomerResults, OwnerCustomer } from "@/lib/owner-types";
import { FormError } from "./shared";

export function CustomerPicker({ onSelect, onAuthError }: { onSelect: (customer: OwnerCustomer) => void; onAuthError: (error: unknown) => void }) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<OwnerCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      ownerAPI<CustomerResults>(`customers?q=${encodeURIComponent(query)}`, undefined, ctrl.signal)
        .then((result) => setCustomers(result.customers))
        .catch((e) => { if (!ctrl.signal.aborted) { setError(e.message); onAuthError(e); } })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [query, onAuthError]);
  return <div className="studio-stack">
    <label className="studio-label">Find by name or phone<input className="studio-input" type="search" autoComplete="off" value={query} maxLength={80} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a name or number..." /></label>
    <FormError message={error} />
    <div className="studio-picker-results" aria-live="polite">
      {loading ? <p className="studio-muted">Looking for your regulars...</p> : !customers.length ? <p className="studio-muted">No match yet. Try another name or choose New customer.</p> : customers.map((c) => <button type="button" key={c.id} onClick={() => onSelect(c)} className="studio-customer-choice"><span><strong>{c.name}</strong><small>{c.phone}</small></span><span>Choose</span></button>)}
      {!loading && customers.length === 20 && <p className="studio-muted studio-small">Type a name or phone number to narrow this list.</p>}
    </div>
  </div>;
}
