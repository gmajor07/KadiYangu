import { describe, expect, it } from "vitest";
import { cloneDesignData, parseDesignData } from "@/lib/design-data";

const valid = { version: 1 as const, canvas: { width: 1080, height: 1350, backgroundColor: "#ffffff" }, elements: [{ id: "title", type: "text" as const, x: 10, y: 20, width: 300, height: 80, rotation: 0, text: "Invite", style: { fontSize: 48, color: "#203b32" } }] };

describe("design data V1", () => {
  it("accepts and clones a valid versioned document", () => { const copy = cloneDesignData(valid); expect(copy).toEqual(valid); expect(copy).not.toBe(valid); });
  it("rejects malformed and unsafe documents", () => { expect(() => parseDesignData({ ...valid, version: 2 })).toThrow(); expect(() => parseDesignData({ ...valid, elements: [{ ...valid.elements[0], width: -1 }] })).toThrow(); expect(() => parseDesignData({ ...valid, extra: true })).toThrow(); });
});
