"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
export function HeroSlideshow({ slides, fallback, fallbackAlt }: { slides: { id: string; imageUrl: string; altText: string }[]; fallback: string | null; fallbackAlt: string }) {
  const items = slides.length ? slides : [{ id: "fallback", imageUrl: fallback || "", altText: fallbackAlt }];
  const [index, setIndex] = useState(0);
  useEffect(() => { if (items.length < 2) return; const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 5000); return () => window.clearInterval(timer); }, [items.length]);
  return <div className="relative aspect-[4/5] w-full" aria-roledescription={items.length > 1 ? "carousel" : undefined}>
    {items.map((slide, i) => <Image key={slide.id} src={slide.imageUrl} alt={slide.altText} fill priority={i === 0} unoptimized sizes="(max-width: 768px) 70vw, 320px" className={`object-contain transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`} />)}
    {items.length > 1 && <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5" aria-label="Hero slides">{items.map((slide, i) => <button key={slide.id} type="button" aria-label={`Show slide ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-rose-gold" : "bg-forest/30"}`} />)}</div>}
  </div>;
}
