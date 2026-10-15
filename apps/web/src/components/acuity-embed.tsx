"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { bookingUrl, site } from "@/lib/site";

const LOAD_TIMEOUT_MS = 10_000;

export function AcuityEmbed({ typeId }: { typeId?: number }) {
  const url = bookingUrl(typeId);
  const [state, setState] = useState<"checking" | "loading" | "loaded" | "failed">("checking");

  // Cross-origin iframes fire `load` even for error pages, so probe the
  // scheduler first: the no-cors fetch rejects on DNS/connection failure
  // while still resolving (opaque) when the server is reachable.
  useEffect(() => {
    let done = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), LOAD_TIMEOUT_MS);
    fetch(url, { mode: "no-cors", signal: ctrl.signal })
      .then(() => {
        if (!done) {
          done = true;
          setState("loading");
        }
      })
      .catch(() => {
        if (!done) {
          done = true;
          setState("failed");
        }
      });
    return () => {
      done = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [url]);

  // Backstop: if the iframe never fires `load`, fall back.
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setState((s) => (s === "loaded" ? s : "failed")), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="bg-bone overflow-hidden rounded-xl">
      {state === "failed" ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="font-display text-3xl tracking-wide text-ink">Scheduler didn&#39;t load</p>
          <p className="text-sm text-ink/70">Give us a call or text and we&#39;ll get you on the books.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={site.phoneHref}
              className="bg-ember hover:bg-sand text-ink font-display rounded-md px-6 py-3 text-lg tracking-widest transition-colors"
            >
              Call {site.phone}
            </a>
            <a
              href={site.smsHref}
              className="border-ink/50 hover:border-ember font-display rounded-md border px-6 py-3 text-lg tracking-widest text-ink transition-colors"
            >
              Text
            </a>
          </div>
          <a
            href={`mailto:${site.email}`}
            className="text-ink/70 hover:text-ink text-sm underline underline-offset-4"
          >
            {site.email}
          </a>
        </div>
      ) : state === "checking" ? (
        <div className="h-[1100px] w-full animate-pulse" />
      ) : (
        <iframe
          src={url}
          title="Book an appointment"
          className="block h-[1100px] w-full border-0"
          loading="lazy"
          onLoad={() => setState("loaded")}
        />
      )}
      <Script src="https://embed.acuityscheduling.com/js/embed.js" strategy="lazyOnload" />
    </div>
  );
}
