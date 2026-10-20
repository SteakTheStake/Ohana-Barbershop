export const appOrigin = () => new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
export const ownerOrigin = () => new URL(process.env.OWNER_APP_URL ?? appOrigin()).origin;
