import { describe, expect, it } from "vitest";
import { validateImage, validateR2Configuration } from "@/lib/storage";
describe("storage validation", () => {
  it("accepts valid PNG signatures and rejects mismatched content", () => {
    const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
    expect(validateImage(png, "image/png")).toBe(true);
    expect(validateImage(Buffer.from("not an image"), "image/png")).toBe(false);
    expect(validateImage(png, "image/svg+xml")).toBe(false);
  });
  it("rejects partial R2 configuration without exposing secrets", () => {
    const old = { ...process.env };
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    delete process.env.R2_BUCKET;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_PUBLIC_BASE_URL;
    expect(() => validateR2Configuration()).toThrow("Incomplete R2 configuration");
    process.env = old;
  });
  it("uses local mode only when no R2 settings are present", () => {
    const old = { ...process.env };
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    for (const key of ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"]) delete process.env[key];
    expect(validateR2Configuration()).toBeNull();
    process.env = old;
  });
});
