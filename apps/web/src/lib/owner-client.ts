import { DateTime } from "luxon";
import { fetchSave, SaveUncertain } from "./save-client";

export const OWNER_ZONE = "America/Los_Angeles";
export class OwnerSessionExpired extends Error {}
export async function ownerAPI<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetchSave(`/api/owner/${path}`, {
    method: data === undefined ? "GET" : "POST", cache: "no-store", signal,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => {
    if (data !== undefined) throw new SaveUncertain("We couldn't read the save confirmation. Retry this unchanged form safely or check your schedule.");
    throw new Error("We couldn't read your schedule. Please refresh.");
  });
  if (response.status === 401) throw new OwnerSessionExpired("Please sign in again, then check your schedule before retrying.");
  if (!response.ok) throw new Error(result.error || "That didn't save. Please try again.");
  return result as T;
}
export const ownerToday = () => DateTime.now().setZone(OWNER_ZONE).toISODate()!;
export const dayLabel = (date: string) => DateTime.fromISO(date, { zone: OWNER_ZONE }).toFormat("cccc, LLL d");
export const dayMove = (date: string, days: number) => DateTime.fromISO(date, { zone: OWNER_ZONE }).plus({ days }).toISODate()!;
export const localTime = (iso: string) => DateTime.fromISO(iso, { zone: OWNER_ZONE }).toFormat("h:mm a");
export const localInput = (iso: string) => DateTime.fromISO(iso, { zone: OWNER_ZONE }).toFormat("HH:mm");
export const localDate = (iso: string) => DateTime.fromISO(iso, { zone: OWNER_ZONE }).toISODate()!;
export const localISO = (date: string, time: string) => DateTime.fromISO(`${date}T${time}`, { zone: OWNER_ZONE }).toUTC().toISO()!;
export const nextBreakTime = () => {
  const now = DateTime.now().setZone(OWNER_ZONE);
  return now.plus({ minutes: (5 - now.minute % 5) % 5 }).toFormat("HH:mm");
};
export const statusLabel = { confirmed: "Booked", completed: "Done", "no-show": "Missed", cancelled: "Cancelled" };
