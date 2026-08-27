import type { MetadataRoute } from "next";

import { getPublicEnvironment } from "@/lib/env/public";

export default function robots(): MetadataRoute.Robots {
  const { NEXT_PUBLIC_SITE_URL: siteUrl } = getPublicEnvironment();
  return {
    rules: {
      allow: "/",
      disallow: ["/admin/", "/api/admin/"],
      userAgent: "*",
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
