"use client";
import { useState } from "react";
import Image from "next/image";
import { fallbackImage, isSafeImagePath } from "@/lib/catalog/images";
export function CatalogImage({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={!failed && src && isSafeImagePath(src) ? src : fallbackImage}
      alt={alt}
      width={1080}
      height={1350}
      unoptimized
      loading={priority ? "eager" : "lazy"}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
