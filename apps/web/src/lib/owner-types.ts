export type OwnerCustomer = { id: number; name: string; phone: string; preferences?: string | null };
export type OwnerService = {
  id: number; name: string; priceCents: number; durationMinutes: number; bufferMinutes: number; active: boolean;
};
export type OwnerVisit = {
  id: number; revision: number; customer: OwnerCustomer; serviceId: number; serviceName: string;
  startsAt: string; endsAt: string; priceCents: number;
  status: "confirmed" | "completed" | "no-show" | "cancelled"; notes?: string | null;
};
export type OwnerBlock = { id: number; reason: string; startsAt: string; endsAt: string };
export type OwnerSettings = {
  bookingEnabled: boolean; announcement?: string | null; leadMinutes: number; bookingDays: number; cancellationHours: number;
  weeklyHours?: { weekday: string; closed?: boolean | null; opens: string; closes: string }[] | null;
};
export type OwnerDay = {
  appointments: OwnerVisit[]; blocks: OwnerBlock[]; services: OwnerService[]; settings: OwnerSettings; updatedAt: string;
  externalEvents?: { id: string; title: string; startsAt: string; endsAt: string }[];
  calendarWarning?: string | null;
};
export type CustomerResults = { customers: OwnerCustomer[]; hasNextPage: boolean; page: number; totalDocs: number };
