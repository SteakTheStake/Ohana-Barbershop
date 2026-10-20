import { createHash } from "node:crypto";
import { APIError, type Payload, type PayloadRequest } from "payload";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

// Receipt and booking commit together. Retrying after a lost HTTP response
// returns the original result, even when the first save changed the revision.
export async function reliableSave<T>(
  payload: Payload, req: PayloadRequest, scope: string, data: Record<string, unknown>,
  save: () => Promise<T>,
): Promise<T> {
  if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestId)) {
    throw new APIError("Please reopen this form before saving.", 400);
  }
  const key = createHash("sha256").update(`${scope}:${data.requestId}`).digest("hex");
  const fingerprint = createHash("sha256").update(canonical(data)).digest("hex");
  const transaction = await payload.db.beginTransaction();
  if (transaction === null) throw new Error("Booking transactions unavailable.");
  req.transactionID = transaction;
  try {
    const existing = await payload.find({ collection: "save-receipts", req, limit: 1, where: { key: { equals: key } } });
    let result: T;
    if (existing.docs[0]) {
      if (existing.docs[0].fingerprint !== fingerprint) throw new APIError("This save was already used for different details. Refresh before trying again.", 409);
      result = existing.docs[0].result as T;
    } else {
      result = await save();
      await payload.create({ collection: "save-receipts", req, data: { key, fingerprint, result: result as Record<string, unknown> } });
    }
    await payload.db.commitTransaction(transaction);
    return result;
  } catch (error) {
    await payload.db.rollbackTransaction(transaction);
    throw error;
  } finally { delete req.transactionID; }
}

export function expectedRevision(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new APIError("Refresh your schedule and reopen this visit before saving.", 409);
  }
  return value;
}
