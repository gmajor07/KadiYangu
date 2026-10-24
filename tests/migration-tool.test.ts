import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

describe("core migration tool safety", () => {
  it("refuses to run without a separately supplied Railway URL", () => {
    expect(() => execFileSync(process.execPath, ["scripts/migrate-core-data.cjs"], { env: { ...process.env, DATABASE_URL: "postgresql://user:pass@localhost:5432/kadiyangu", RAILWAY_DB_URL: "" }, stdio: "pipe" })).toThrow();
  });
  it("keeps production inserts idempotent and rollback-safe", () => {
    const source = readFileSync("scripts/migrate-core-data.cjs", "utf8");
    expect(source).toContain("ON CONFLICT DO NOTHING");
    expect(source).toContain('await target.query("COMMIT")');
    expect(source).toContain('await target.query("ROLLBACK")');
    expect(source).toContain("R2_PUBLIC_BASE_URL");
  });
});
