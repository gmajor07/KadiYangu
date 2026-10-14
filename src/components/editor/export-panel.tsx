"use client";
import { useState } from "react";
import type Konva from "konva";
import { jsPDF } from "jspdf";
import { recordExportAction } from "@/app/editor/export-actions";

export function ExportPanel({ stageRef, width, height, designId, backgroundImage, premiumPrice, premiumCurrency }: { stageRef: React.RefObject<Konva.Stage | null>; width: number; height: number; designId: string; backgroundImage?: string | null; premiumPrice?: number | null; premiumCurrency?: string }) {
  const [format, setFormat] = useState<"png" | "jpg" | "pdf">("png");
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [open, setOpen] = useState(false);
  const exportCard = async () => {
    const authorization = await recordExportAction({ designId, format, quality });
    if (!authorization.ok) { if (authorization.upgradeOrderId) window.location.href = `/checkout/${authorization.upgradeOrderId}`; return; }
    const stage = stageRef.current; if (!stage) return;
    await new Promise((resolve) => window.setTimeout(resolve, 500)); stage.draw();
    const ratio = quality === "high" ? 2 : 1; const stageUrl = stage.toDataURL({ pixelRatio: ratio });
    const watermark = document.createElement("canvas"); watermark.width = width * ratio; watermark.height = height * ratio;
    const context = watermark.getContext("2d"); if (!context) return;
    const compose = (background?: HTMLImageElement) => {
      if (background) context.drawImage(background, 0, 0, watermark.width, watermark.height);
      const stageImage = new Image(); stageImage.onload = () => {
        context.drawImage(stageImage, 0, 0, watermark.width, watermark.height);
        if (quality === "standard") { context.fillStyle = "rgba(32,59,50,.72)"; context.font = `${Math.max(18, watermark.width / 45)}px sans-serif`; context.textAlign = "right"; context.fillText("Created with KadiYangu", watermark.width - 24, watermark.height - 24); }
        if (format === "pdf") { const pdf = new jsPDF({ orientation: width >= height ? "landscape" : "portrait", unit: "px", format: [width, height] }); pdf.addImage(watermark.toDataURL("image/jpeg", .92), "JPEG", 0, 0, width, height); pdf.save("kadiyangu-design.pdf"); }
        else { const link = document.createElement("a"); link.download = `kadiyangu-design.${format}`; link.href = watermark.toDataURL(format === "jpg" ? "image/jpeg" : "image/png", .92); link.click(); }
        setOpen(false);
      }; stageImage.src = stageUrl;
    };
    if (backgroundImage) { const background = new Image(); background.onload = () => compose(background); background.onerror = () => compose(); background.src = backgroundImage; } else compose();
  };
  return <div className="relative"><button onClick={() => setOpen(!open)} className="rounded-full border px-3 py-2 text-xs">Export</button>{open && <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border bg-white p-4 shadow-xl"><p className="font-semibold">Download your card</p><p className="mt-1 text-xs text-forest/60">Choose free standard or premium export.</p><label className="mt-3 block text-xs">Format<select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="png">PNG</option><option value="jpg">JPG</option><option value="pdf">PDF</option></select></label><label className="mt-3 block text-xs">Quality<select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}><option value="standard">FREE · Standard quality · watermark</option><option value="high">PREMIUM · High quality · no watermark{premiumPrice ? ` · ${premiumCurrency || "TZS"} ${premiumPrice.toLocaleString()}` : " · unavailable"}</option></select></label><button onClick={exportCard} className="mt-4 w-full rounded-full bg-forest px-3 py-2 text-xs text-white">Download</button></div>}</div>;
}
