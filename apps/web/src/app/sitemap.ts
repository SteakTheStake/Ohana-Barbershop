import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/services", "/book", "/about", "/contact", "/shop"].map((p) => ({ url: `${site.url}${p}` }));
}
