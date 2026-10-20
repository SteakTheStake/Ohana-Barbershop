import type { PayloadRequest } from "payload";

type Effects = Map<string, () => Promise<unknown>>;
const state = globalThis as typeof globalThis & { ohanaTransactionEffects?: Map<string | number, Effects> };
const pending = state.ohanaTransactionEffects ??= new Map();

export async function afterCommit(req: PayloadRequest, key: string, effect: () => Promise<unknown>) {
  const id = await req.transactionID;
  if (id == null) throw new Error("Post-commit work requires a database transaction.");
  const effects = pending.get(id) ?? new Map();
  effects.set(key, effect);
  pending.set(id, effects);
}

export function finishTransaction(id: string | number, committed: boolean) {
  const effects = pending.get(id);
  pending.delete(id);
  if (!committed || !effects) return;
  // External failures must never turn an already-committed save into an error.
  setImmediate(() => {
    for (const effect of effects.values()) {
      void Promise.resolve().then(effect).catch(() => console.error("Ohana post-commit synchronization failed; scheduled reconciliation will retry."));
    }
  });
}
