import { getPayload } from "payload";
import config from "@payload-config";

export async function getCMS() {
  return getPayload({ config });
}
