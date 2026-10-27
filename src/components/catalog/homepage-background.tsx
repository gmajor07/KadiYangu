"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Background = { id: string; imageUrl: string; altText: string };

export function HomepageBackground({ slides }: { slides: Background[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const update = () => {
      window.clearInterval(timer);
      if (!motion.matches) timer = window.setInterval(() => setIndex(value => (value + 1) % slides.length), 8000);
    };
    update();
    motion.addEventListener("change", update);
    return () => { window.clearInterval(timer); motion.removeEventListener("change", update); };
  }, [slides.length, paused]);

  if (!slides.length) return null;
  return <>
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {slides.map((slide, i) => <Image key={slide.id} src={slide.imageUrl} alt="" fill unoptimized preload={i === 0} sizes="100vw" className={`object-cover object-center transition-opacity duration-1000 motion-reduce:transition-none ${i === index % slides.length ? "opacity-100" : "opacity-0"}`} />)}
      <div className="absolute inset-0 bg-linear-to-r from-ivory/95 via-ivory/80 to-ivory/55" />
    </div>
    {slides.length > 1 && <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} className="absolute bottom-2 right-4 z-20 rounded-full bg-ivory/90 px-3 py-1 text-xs text-forest shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2">{paused ? "Play background" : "Pause background"}</button>}
  </>;
}
