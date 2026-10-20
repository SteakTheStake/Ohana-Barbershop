import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ValidationError, type Payload } from "payload";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ohana-customer";
export const SESSION_SECONDS = 14 * 24 * 60 * 60;
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const digest = (value: string) => createHmac("sha256", process.env.PAYLOAD_SECRET!).update(value).digest("hex");
export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function isUniqueError(error: unknown): boolean {
  if (error instanceof ValidationError && error.data?.errors.some((e) => /unique|already exists/i.test(e.message))) return true;
  const message = String(error) + String((error as { cause?: unknown })?.cause ?? "");
  return /unique|already exists/i.test(message);
}

export function clientAddress(request: NextRequest) {
  // Only trust this header when the deployment proxy overwrites it.
  return process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
}

export async function rateLimit(payload: Payload, scope: string, identity: string, limit: number, seconds: number) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const prefix = digest(`${scope}:${identity}:${bucket}`);
  for (let slot = 0; slot < limit; slot++) {
    try {
      await payload.create({ collection: "rate-limits", data: {
        key: `${prefix}:${slot}`, expiresAt: new Date((bucket + 2) * seconds * 1000).toISOString(),
      } });
      return;
    } catch (error) {
      if (!isUniqueError(error)) throw error;
    }
  }
  throw new RequestError("Too many attempts. Please wait before trying again.", 429);
}

async function twilio(path: "Verifications" | "VerificationCheck", body: URLSearchParams) {
  const { TWILIO_ACCOUNT_SID: account, TWILIO_AUTH_TOKEN: token, TWILIO_VERIFY_SERVICE_SID: service } = process.env;
  if (!account || !token || !service) throw new RequestError("Phone verification is not configured. Please call the shop.", 503);
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${account}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new RequestError(path === "VerificationCheck" ? "Invalid or expired verification code." : "Unable to send a code. Please try again later.", path === "VerificationCheck" ? 400 : 503);
  return response.json() as Promise<{ sid: string; status: string }>;
}

export async function sendCode(payload: Payload, phone: string) {
  const development = process.env.NODE_ENV !== "production" && process.env.SMS_PROVIDER === "console";
  if (!development && process.env.SMS_PROVIDER !== "twilio") throw new RequestError("Phone verification is unavailable. Please call the shop.", 503);
  const code = development ? String(randomInt(100000, 1000000)) : undefined;
  const provider = development ? undefined : await twilio("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
  const challenge = await payload.create({ collection: "phone-challenges", data: {
    phone, codeHash: code ? digest(`${phone}:${code}`) : undefined, providerId: provider?.sid,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  } });
  return { challengeId: challenge.id, ...(code ? { developmentCode: code } : {}) };
}

export async function checkCode(payload: Payload, challengeId: number, code: string, name: string) {
  const challenge = await payload.findByID({ collection: "phone-challenges", id: challengeId }).catch(() => null);
  if (!challenge || Date.parse(challenge.expiresAt) <= Date.now()) throw new RequestError("Invalid or expired verification code.");
  await rateLimit(payload, "verify-phone", challenge.phone, 5, 600);
  if (process.env.NODE_ENV !== "production" && process.env.SMS_PROVIDER === "console" && challenge.codeHash) {
    const actual = Buffer.from(digest(`${challenge.phone}:${code}`));
    const expected = Buffer.from(challenge.codeHash);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new RequestError("Invalid or expired verification code.");
  } else {
    if (!challenge.providerId) throw new RequestError("Invalid verification request.");
    const result = await twilio("VerificationCheck", new URLSearchParams({ VerificationSid: challenge.providerId, Code: code }));
    if (result.status !== "approved") throw new RequestError("Invalid or expired verification code.");
  }
  // A unique receipt consumes the challenge exactly once, even during parallel requests.
  try {
    await payload.create({ collection: "used-challenges", data: { key: String(challenge.id), expiresAt: challenge.expiresAt } });
  } catch (error) {
    if (isUniqueError(error)) throw new RequestError("That code has already been used. Request another code.");
    throw error;
  }
  const existing = await payload.find({ collection: "customers", where: { phone: { equals: challenge.phone } }, limit: 1 });
  let customer = existing.docs[0];
  if (!customer) {
    try {
      customer = await payload.create({ collection: "customers", data: { name, phone: challenge.phone } });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      customer = (await payload.find({ collection: "customers", where: { phone: { equals: challenge.phone } }, limit: 1 })).docs[0];
    }
  }
  const token = randomBytes(32).toString("hex");
  await payload.create({ collection: "customer-sessions", data: {
    tokenHash: hash(token), customer: customer.id,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
  } });
  return { token, customer: { id: customer.id, name: customer.name, phone: customer.phone } };
}

export async function currentCustomer(payload: Payload, request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await payload.find({
    collection: "customer-sessions", depth: 0, limit: 1,
    where: { and: [{ tokenHash: { equals: hash(token) } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
  });
  if (!result.docs[0]) return null;
  const id = result.docs[0].customer;
  const customer = await payload.findByID({ collection: "customers", id: typeof id === "object" ? id.id : id }).catch(() => null);
  return customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null;
}
