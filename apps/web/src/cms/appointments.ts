import { DateTime } from "luxon";
import { APIError, type CollectionConfig, type CollectionAfterChangeHook } from "payload";
import { ownerAccess, privateOnly } from "./access";
import { readAvailability } from "../lib/booking-data";
import { occupancyKeys, overlaps, SHOP_TIMEZONE, type BookableService } from "../lib/scheduling";
import { recordAppointmentHistory } from "./reliability";
import { googleBusy } from "../lib/google-calendar";
import { queueGoogleSync } from "../lib/google-calendar-sync";

const idOf = (v: number | { id: number }) => typeof v === "object" ? v.id : v;

const syncOccupancy: CollectionAfterChangeHook = async ({ doc, previousDoc, req, collection }) => {
  const appointment = collection.slug === "appointments";
  const field = appointment ? "appointment" : "timeOff";
  if (previousDoc && doc.startsAt === previousDoc.startsAt &&
    doc[appointment ? "blockedUntil" : "endsAt"] === previousDoc[appointment ? "blockedUntil" : "endsAt"] &&
    doc.status === previousDoc.status) return doc;
  await req.payload.delete({ collection: "occupancy", where: { [field]: { equals: doc.id } }, req });
  if (appointment && doc.status === "cancelled") return doc;
  try {
    for (const key of occupancyKeys(doc.startsAt, appointment ? doc.blockedUntil : doc.endsAt)) {
      await req.payload.create({ collection: "occupancy", data: { key, [field]: doc.id }, req });
    }
  } catch {
    // Throwing rolls back both the document and its locks. Never swallow this.
    throw new APIError("That time overlaps another appointment or time off. Please choose another time.", 409);
  }
  return doc;
};

export const Appointments: CollectionConfig = {
  slug: "appointments", access: { ...ownerAccess, delete: privateOnly },
  admin: {
    group: "Shop Management", useAsTitle: "serviceName",
    defaultColumns: ["startsAt", "customer", "serviceName", "status"],
    description: "Times display in your browser timezone. Booking uses Pacific time. Cancel rather than delete to retain visit history.",
  },
  defaultSort: "startsAt",
  fields: [
    { name: "revision", type: "number", required: true, defaultValue: 1, admin: { readOnly: true } },
    { name: "customer", type: "relationship", relationTo: "customers", required: true, index: true },
    { name: "service", type: "relationship", relationTo: "services", required: true },
    { name: "startsAt", type: "date", required: true, index: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
    { name: "endsAt", type: "date", required: true, admin: { readOnly: true } },
    { name: "blockedUntil", type: "date", required: true, index: true, admin: { readOnly: true } },
    { name: "serviceName", type: "text", required: true, admin: { readOnly: true } },
    { name: "priceCents", type: "number", required: true, admin: { readOnly: true } },
    { name: "status", type: "select", required: true, defaultValue: "confirmed", options: [
      { label: "Confirmed", value: "confirmed" }, { label: "Completed", value: "completed" },
      { label: "No-show", value: "no-show" }, { label: "Cancelled", value: "cancelled" },
    ] },
    { name: "notes", type: "textarea", maxLength: 1000, admin: { description: "Customer's booking notes." } },
  ],
  hooks: {
    beforeValidate: [async ({ data, originalDoc, req, operation }) => {
      if (!data) return data;
      if (operation === "update" && req.context.expectedRevision !== undefined &&
        req.context.expectedRevision !== originalDoc.revision) {
        throw new APIError("This visit changed in another window. Refresh your schedule and reopen it; your changes were not saved.", 409);
      }
      data.revision = operation === "update" ? originalDoc.revision + 1 : 1;
      // Recheck customer permissions and policy against the transaction's
      // current document, not just the endpoint's earlier read.
      if (operation === "update" && typeof req.context.ohanaCustomerId === "number") {
        if (idOf(originalDoc.customer) !== req.context.ohanaCustomerId) throw new APIError("Appointment not found.", 404);
        if (originalDoc.status !== "confirmed") throw new APIError("Only confirmed appointments can be changed.", 409);
        const settings = await req.payload.findGlobal({ slug: "shop-settings", req });
        if (Date.parse(originalDoc.startsAt) - Date.now() < settings.cancellationHours * 3600_000) {
          throw new APIError(`Changes require ${settings.cancellationHours} hours' notice. Please call the shop.`, 409);
        }
      }
      const serviceId = idOf(data.service ?? originalDoc?.service);
      const start = DateTime.fromISO(data.startsAt ?? originalDoc?.startsAt ?? "", { setZone: true });
      if (!start.isValid || !serviceId) throw new APIError("A service and valid start time are required.", 400);
      data.startsAt = start.toUTC().toISO();
      const changed = !originalDoc || data.startsAt !== originalDoc.startsAt ||
        serviceId !== idOf(originalDoc.service) ||
        originalDoc.status === "cancelled" && data.status !== "cancelled";
      if (originalDoc?.status === "cancelled" && data.status && data.status !== "cancelled" && data.status !== "confirmed") {
        throw new APIError("Only a confirmed appointment can reactivate a cancelled visit.", 400);
      }
      if (!changed) {
        for (const field of ["endsAt", "blockedUntil", "serviceName", "priceCents"]) data[field] = originalDoc[field];
        return data;
      }
      const service = await req.payload.findByID({ collection: "services", id: serviceId, req }) as BookableService;
      const slots = await readAvailability(req.payload, service, start.setZone(SHOP_TIMEZONE).toISODate()!, req, originalDoc?.id);
      if (!slots.some((s) => Date.parse(s) === start.toMillis())) throw new APIError("That appointment is outside bookable hours or no longer available.", 409);
      data.endsAt = start.plus({ minutes: service.durationMinutes }).toUTC().toISO();
      data.blockedUntil = start.plus({ minutes: service.durationMinutes + service.bufferMinutes }).toUTC().toISO();
      const sameService = originalDoc && serviceId === idOf(originalDoc.service);
      data.serviceName = sameService ? originalDoc.serviceName : service.name;
      data.priceCents = sameService ? originalDoc.priceCents : service.priceCents;
      return data;
    }],
    afterChange: [syncOccupancy, recordAppointmentHistory, async ({ req, doc }) => { await queueGoogleSync(req); return doc; }],
  },
};

export const TimeOff: CollectionConfig = {
  slug: "time-off", labels: { singular: "Time Off", plural: "Time Off" },
  access: ownerAccess, admin: { group: "Shop Management", useAsTitle: "reason", defaultColumns: ["reason", "startsAt", "endsAt"] },
  fields: [
    { name: "reason", type: "text", required: true },
    { name: "startsAt", type: "date", required: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
    { name: "endsAt", type: "date", required: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
  ],
  hooks: {
    beforeValidate: [async ({ data, originalDoc }) => {
      const startsAt = data?.startsAt ?? originalDoc?.startsAt;
      const endsAt = data?.endsAt ?? originalDoc?.endsAt;
      occupancyKeys(startsAt, endsAt);
      if (!originalDoc || startsAt !== originalDoc.startsAt || endsAt !== originalDoc.endsAt) {
        const end = DateTime.fromISO(endsAt).setZone(SHOP_TIMEZONE);
        for (let day = DateTime.fromISO(startsAt).setZone(SHOP_TIMEZONE).startOf("day"); day < end; day = day.plus({ days: 1 })) {
          const busy = await googleBusy(day.toISODate()!);
          if (busy.some((event) => overlaps(Date.parse(startsAt), Date.parse(endsAt), Date.parse(event.startsAt), Date.parse(event.blockedUntil)))) {
            throw new APIError("That time overlaps a Google Calendar booking. Move that booking before blocking time.", 409);
          }
        }
      }
      return data;
    }],
    afterChange: [syncOccupancy, async ({ req, doc }) => { await queueGoogleSync(req); return doc; }],
    afterDelete: [async ({ req, doc }) => { await queueGoogleSync(req); return doc; }],
    beforeDelete: [async ({ id, req }) => {
      await req.payload.delete({ collection: "occupancy", where: { timeOff: { equals: id } }, req });
    }],
  },
};
