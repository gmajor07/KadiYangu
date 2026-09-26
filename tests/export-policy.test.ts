import { describe, expect, it } from "vitest";
import { exportScale, exportWatermark, hasPremiumExport } from "@/lib/export/export-policy";
describe("export policy", () => { it("keeps standard exports watermarked", () => { expect(exportScale("standard")).toBe(1); expect(exportWatermark(false)).toBe(true); }); it("allows high quality only for an entitlement", () => { expect(exportScale("high")).toBe(2); expect(hasPremiumExport(true)).toBe(true); expect(exportWatermark(true)).toBe(false); }); });
