import type { MetadataRoute } from "next";
import { site } from "@/config/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(site.indexable
        ? {
            allow: "/",
            disallow: [
              "/admin",
              "/dashboard",
              "/api",
              "/login",
              "/register",
              "/editor",
            ],
          }
        : { disallow: "/" }),
    },
    ...(site.indexable ? { sitemap: `${site.url}/sitemap.xml` } : {}),
  };
}
