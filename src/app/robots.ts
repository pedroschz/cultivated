import { MetadataRoute } from "next";
import { WEB_BASE_URL } from "@/lib/config";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = WEB_BASE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/dashboard/", "/onboarding/", "/practice/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
