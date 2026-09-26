import "server-only";
export const EXPORT_FORMATS = ["png", "jpg", "pdf"] as const;
export const EXPORT_QUALITIES = ["standard", "high"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportQuality = (typeof EXPORT_QUALITIES)[number];
export function exportScale(quality: ExportQuality) { return quality === "high" ? 2 : 1; }
export function hasPremiumExport(entitled: boolean) { return entitled; }
export function exportWatermark(entitled: boolean) { return !entitled; }
