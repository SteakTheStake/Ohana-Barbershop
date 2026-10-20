"use client";

import { useRef } from "react";

export class SaveUncertain extends Error {}

// The same mounted form keeps its key across retries. No customer data is
// persisted in browser storage.
export function useSaveRequest() {
  const last = useRef<{ signature: string; requestId: string } | null>(null);
  return (data: Record<string, unknown>) => {
    const signature = JSON.stringify(data);
    if (last.current?.signature !== signature) last.current = { signature, requestId: crypto.randomUUID() };
    return { ...data, requestId: last.current.requestId };
  };
}

export async function fetchSave(url: string, init: RequestInit) {
  const mutation = init.method !== "GET";
  const safeRetry = typeof init.body === "string" && typeof JSON.parse(init.body).requestId === "string";
  for (let attempt = 0; ; attempt++) {
    try {
      const timeout = AbortSignal.timeout(20_000);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      const response = await fetch(url, { ...init, signal });
      if (safeRetry && response.status >= 500 && attempt === 0) continue;
      if (response.status >= 500) {
        if (!mutation) throw new Error("We couldn't refresh your shop. Check your connection and try again.");
        throw new SaveUncertain("We couldn't confirm the save. Keep this form unchanged and retry, or check the schedule before starting again.");
      }
      return response;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (safeRetry && attempt === 0) continue;
      if (!mutation) throw new Error("We couldn't refresh your shop. Check your connection and try again.");
      throw new SaveUncertain("Connection interrupted. The save may have succeeded. Retry this unchanged form safely, or check your schedule before starting again.");
    }
  }
}
