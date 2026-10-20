import type { CollectionConfig, Field } from "payload";
import { privateAccess } from "./access";

const expiry: Field = { name: "expiresAt", type: "date", required: true, index: true };
export const AuthRecords: CollectionConfig[] = [
  {
    slug: "phone-challenges", access: privateAccess, admin: { hidden: true },
    fields: [
      { name: "phone", type: "text", required: true },
      { name: "codeHash", type: "text" },
      { name: "providerId", type: "text" },
      expiry,
    ],
  },
  {
    slug: "used-challenges", access: privateAccess, admin: { hidden: true },
    fields: [{ name: "key", type: "text", required: true, unique: true }, expiry],
  },
  {
    slug: "customer-sessions", access: privateAccess, admin: { hidden: true },
    fields: [
      { name: "tokenHash", type: "text", required: true, unique: true },
      { name: "customer", type: "relationship", relationTo: "customers", required: true },
      expiry,
    ],
  },
  {
    slug: "rate-limits", access: privateAccess, admin: { hidden: true },
    fields: [{ name: "key", type: "text", required: true, unique: true }, expiry],
  },
];
