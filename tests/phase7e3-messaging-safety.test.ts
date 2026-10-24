import { describe, expect, it } from "vitest";
import { isSafePhase7e3DatabaseUrl } from "./phase7e3-messaging.integration.test";

describe("Phase 7E.3 database safety guard", () => {
  it("accepts local PostgreSQL URLs with usernames", () => {
    expect(isSafePhase7e3DatabaseUrl("postgresql://goodluck@localhost:5432/kadiyangu_phase7e1_test")).toBe(true);
    expect(isSafePhase7e3DatabaseUrl("postgres://user:password@127.0.0.1/kadiyangu_phase7e1_test?sslmode=disable")).toBe(true);
    expect(isSafePhase7e3DatabaseUrl("postgresql://user@[::1]:5432/kadiyangu_phase7e1_test")).toBe(true);
  });

  it("rejects remote, production and wrong-database URLs", () => {
    expect(isSafePhase7e3DatabaseUrl("postgresql://user@railway.app/kadiyangu_phase7e1_test")).toBe(false);
    expect(isSafePhase7e3DatabaseUrl("postgresql://user@localhost:5432/railway")).toBe(false);
    expect(isSafePhase7e3DatabaseUrl("postgresql://user@localhost:5432/kadiyangu")).toBe(false);
    expect(isSafePhase7e3DatabaseUrl("https://localhost/kadiyangu_phase7e1_test")).toBe(false);
    expect(isSafePhase7e3DatabaseUrl("not-a-database-url")).toBe(false);
  });
});
