import type { CollectionConfig, GlobalConfig } from "payload";
import { ownerAccess, ownerOnly, privateOnly } from "./access";
import { normalizePhone } from "../lib/scheduling";

const fiveMinutes = (value: number | null | undefined) =>
  typeof value === "number" && Number.isInteger(value) && value % 5 === 0 || "Use a whole multiple of 5 minutes.";
const timeValue = (value: string | null | undefined) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || "Use HH:mm (24-hour time).";

export const Users: CollectionConfig = {
  slug: "users", labels: { singular: "Owner", plural: "Owners" },
  auth: {
    tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 15 * 60_000,
    cookies: { sameSite: "Strict", secure: process.env.NODE_ENV === "production" },
  },
  access: { ...ownerAccess, admin: ownerOnly },
  admin: { useAsTitle: "email", group: "Shop Management" },
  fields: [{ name: "name", type: "text", required: true }],
};

export const Services: CollectionConfig = {
  slug: "services", access: ownerAccess,
  admin: { useAsTitle: "name", group: "Shop Management", defaultColumns: ["name", "priceCents", "durationMinutes", "active"] },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true,
      validate: (v: unknown) => typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) || "Use lowercase words separated by hyphens." },
    { name: "description", type: "textarea" },
    { name: "priceCents", label: "Price (cents)", type: "number", min: 0, required: true,
      validate: (v: unknown) => Number.isInteger(v) || "Use whole cents." },
    { name: "durationMinutes", type: "number", min: 5, max: 240, required: true, validate: fiveMinutes },
    { name: "bufferMinutes", type: "number", min: 0, max: 60, required: true, defaultValue: 0, validate: fiveMinutes },
    { name: "active", type: "checkbox", defaultValue: true, required: true },
    { name: "sortOrder", type: "number", defaultValue: 0 },
  ],
  hooks: { beforeDelete: [async ({ id, req }) => {
    const visits = await req.payload.count({ collection: "appointments", where: { service: { equals: id } }, req });
    if (visits.totalDocs) throw new Error("This service has appointment history. Mark it inactive instead of deleting it.");
  }] },
};

export const Customers: CollectionConfig = {
  slug: "customers", access: ownerAccess,
  admin: { useAsTitle: "name", group: "Shop Management", defaultColumns: ["name", "phone", "updatedAt"] },
  fields: [
    { name: "name", type: "text", required: true, maxLength: 100 },
    { name: "phone", type: "text", unique: true, required: true,
      validate: (v: unknown) => { try { return normalizePhone(v) === v || "Use E.164 format, e.g. +14583098765."; } catch { return "Enter a valid phone number."; } } },
    { name: "preferences", type: "textarea", admin: { description: "Private owner notes. Never exposed to customers." } },
  ],
  hooks: {
    beforeChange: [async ({ data, originalDoc, req }) => {
      if (originalDoc?.id && data.phone && data.phone !== originalDoc.phone) {
        await req.payload.delete({ collection: "customer-sessions", where: { customer: { equals: originalDoc.id } }, req });
      }
      return data;
    }],
    beforeDelete: [async ({ id, req }) => {
    const visits = await req.payload.count({ collection: "appointments", where: { customer: { equals: id } }, req });
    if (visits.totalDocs) throw new Error("This customer has appointment history. Contact your administrator to arrange data removal.");
    await req.payload.delete({ collection: "customer-sessions", where: { customer: { equals: id } }, req });
  }] },
};

export const ShopSettings: GlobalConfig = {
  slug: "shop-settings", label: "Ohana Booking Settings",
  access: { read: ownerOnly, update: ownerOnly },
  admin: { group: "Shop Management", description: "Review prices, durations, hours, and policy before enabling online bookings. Times are always Albany, Oregon (Pacific time)." },
  fields: [
    { name: "bookingEnabled", type: "checkbox", defaultValue: false, required: true,
      admin: { description: "Off until the owner confirms the working plan. Customers cannot book or reschedule while off; the owner still can." } },
    { name: "announcement", type: "textarea", maxLength: 500, defaultValue: "Aloha! Call or text us while we get online booking ready." },
    { name: "leadMinutes", type: "number", required: true, defaultValue: 60, min: 0, max: 10080,
      validate: (v: unknown) => Number.isInteger(v) || "Use whole minutes." },
    { name: "bookingDays", type: "number", required: true, defaultValue: 30, min: 1, max: 90,
      validate: (v: unknown) => Number.isInteger(v) || "Use whole days." },
    { name: "cancellationHours", type: "number", required: true, defaultValue: 24, min: 0, max: 168 },
    { name: "weeklyHours", type: "array", maxRows: 7,
      validate: (rows) => !rows || new Set(rows.map((r) => (r as { weekday: string }).weekday)).size === rows.length || "Each weekday may appear only once.",
      fields: [
        { name: "weekday", type: "select", required: true, options: [
          { label: "Sunday", value: "0" }, { label: "Monday", value: "1" },
          { label: "Tuesday", value: "2" }, { label: "Wednesday", value: "3" },
          { label: "Thursday", value: "4" }, { label: "Friday", value: "5" },
          { label: "Saturday", value: "6" },
        ] },
        { name: "closed", type: "checkbox", defaultValue: true },
        { name: "opens", type: "text", required: true, defaultValue: "09:00", validate: timeValue },
        { name: "closes", type: "text", required: true, defaultValue: "17:00", validate: timeValue },
      ] },
  ],
  hooks: {
    beforeValidate: [({ data }) => {
      for (const h of data?.weeklyHours ?? []) {
        if (!h.closed && h.opens >= h.closes) throw new Error("Closing time must be after opening time. Overnight hours are not supported.");
      }
      return data;
    }],
  },
};

export const Occupancy: CollectionConfig = {
  slug: "occupancy", access: { create: privateOnly, read: privateOnly, update: privateOnly, delete: privateOnly },
  admin: { hidden: true },
  fields: [
    { name: "key", type: "text", required: true, unique: true },
    { name: "appointment", type: "relationship", relationTo: "appointments", index: true },
    { name: "timeOff", type: "relationship", relationTo: "time-off", index: true },
  ],
};
