import type { CollectionConfig, CollectionAfterChangeHook } from "payload";
import { ownerOnly, privateOnly } from "./access";

export const SaveReceipts: CollectionConfig = {
  slug: "save-receipts", admin: { hidden: true }, lockDocuments: false,
  access: { create: privateOnly, read: privateOnly, update: privateOnly, delete: privateOnly },
  fields: [
    { name: "key", type: "text", required: true, unique: true },
    { name: "fingerprint", type: "text", required: true },
    { name: "result", type: "json", required: true },
  ],
};

export const AppointmentHistory: CollectionConfig = {
  slug: "appointment-history", lockDocuments: false,
  admin: { group: "Shop Management", defaultColumns: ["appointmentId", "action", "actor", "createdAt"] },
  access: { create: privateOnly, read: ownerOnly, update: privateOnly, delete: privateOnly },
  fields: [
    { name: "appointmentId", type: "number", required: true, index: true },
    { name: "action", type: "text", required: true },
    { name: "actor", type: "text", required: true },
    { name: "before", type: "json" },
    { name: "after", type: "json", required: true },
  ],
};

// Keep history minimal: no phone numbers, customer names, or private notes.
const snapshot = (doc: Record<string, unknown>) => ({
  startsAt: doc.startsAt, endsAt: doc.endsAt, status: doc.status,
  serviceName: doc.serviceName, revision: doc.revision,
});

export const recordAppointmentHistory: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  await req.payload.create({
    collection: "appointment-history", req,
    data: {
      appointmentId: doc.id, action: operation,
      actor: req.user?.collection === "users" ? `Owner #${req.user.id}`
        : typeof req.context.ohanaCustomerId === "number" ? `Customer #${req.context.ohanaCustomerId}` : "System",
      before: operation === "update" && previousDoc ? snapshot(previousDoc) : null, after: snapshot(doc),
    },
  });
  return doc;
};
