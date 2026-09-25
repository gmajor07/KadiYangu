import type { Metadata } from "next";
import { site } from "@/config/site";
export function catalogMetadata(
  title: string,
  description: string,
  path: string,
  filtered = false,
  image?: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: site.indexable && !filtered, follow: site.indexable },
    openGraph: {
      title: `${title} | KadiYangu`,
      description,
      url: path,
      type: "website",
      siteName: site.name,
      ...(image && !image.endsWith(".svg")
        ? { images: [{ url: image, alt: title }] }
        : {}),
    },
  };
}
