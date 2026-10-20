"use client";

import { useEffect, useState } from "react";
import { ownerAPI } from "@/lib/owner-client";
import type { CustomerResults, OwnerCustomer } from "@/lib/owner-types";
import { FormError, StudioIcon } from "./shared";

export function Customers({ refresh, onEdit, onBook, onAuthError }: { refresh: number; onEdit: (customer?: OwnerCustomer) => void; onBook: (customer: OwnerCustomer) => void; onAuthError: (error: unknown) => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CustomerResults | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      ownerAPI<CustomerResults>(`customers?q=${encodeURIComponent(query)}&page=${page}`, undefined, ctrl.signal)
        .then(setResult)
        .catch((e) => { if (!ctrl.signal.aborted) { setError(e.message); onAuthError(e); } })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [query, page, refresh, onAuthError]);
  return <section className="studio-customers">
    <div className="studio-day-bar"><div><p className="studio-kicker">People, not paperwork</p><h1>Your Ohana</h1><p className="studio-muted">Find a regular, update a number, remember their usual.</p></div><button className="studio-button primary" onClick={() => onEdit()}><StudioIcon name="plus" />Add customer</button></div>
    <label className="studio-label studio-search">Search by name or phone<input className="studio-input" type="search" maxLength={80} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Who's coming in?" /></label>
    <FormError message={error} />
    {loading && <p className="studio-muted" role="status">Finding your ohana...</p>}
    <div className="studio-customer-list" aria-busy={loading}>
      {!loading && result?.customers.length === 0 && <div className="studio-empty"><StudioIcon name="people" /><h2>{query ? "No match just yet." : "Every regular starts here."}</h2><p>{query ? "Try a different name or phone number." : "Add your first customer to get started."}</p></div>}
      {result?.customers.map((customer) => <article key={customer.id} className="studio-customer-row">
        <button className="studio-customer-details" onClick={() => onEdit(customer)} disabled={loading}><span className="studio-avatar" aria-hidden="true">{customer.name.charAt(0).toUpperCase()}</span><span><strong>{customer.name}</strong><small>{customer.phone}</small>{customer.preferences && <small className="studio-private-preview">Private note: {customer.preferences}</small>}</span></button>
        <div className="studio-customer-actions"><a className="studio-button quiet" href={`tel:${customer.phone}`}>Call</a><button className="studio-button secondary" disabled={loading} onClick={() => onEdit(customer)}>Edit details</button><button className="studio-button primary" disabled={loading} onClick={() => onBook(customer)}>Book cut</button></div>
      </article>)}
    </div>
    {result && <div className="studio-pagination"><button className="studio-button quiet" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="studio-muted studio-small">Page {result.page} / {result.totalDocs} customers</span><button className="studio-button quiet" disabled={!result.hasNextPage || loading} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
  </section>;
}
