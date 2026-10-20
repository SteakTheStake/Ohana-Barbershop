import type { Access } from "payload";

export const ownerOnly = (({ req }) => req.user?.collection === "users") satisfies Access;
export const privateOnly: Access = () => false;
export const ownerAccess = {
  create: ownerOnly, read: ownerOnly, update: ownerOnly, delete: ownerOnly,
};
export const privateAccess = {
  create: privateOnly, read: privateOnly, update: privateOnly, delete: privateOnly,
};
