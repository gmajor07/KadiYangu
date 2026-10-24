import { describe, expect, it } from "vitest";
import { serializeJsonValue } from "../scripts/serialize-json.cjs";

describe("migration JSON serialization", () => {
  it("serializes objects, arrays and nested values", () => {
    expect(JSON.parse(serializeJsonValue({ a: [1, { b: true }] })!)).toEqual({ a: [1, { b: true }] });
    expect(JSON.parse(serializeJsonValue(["x", null, 3])!)).toEqual(["x", null, 3]);
  });
  it("preserves null and validates already serialized JSON", () => {
    expect(serializeJsonValue(null)).toBeNull();
    expect(serializeJsonValue('{"ok":true}')).toBe('{"ok":true}');
    expect(() => serializeJsonValue("not-json")).toThrow();
  });
});
