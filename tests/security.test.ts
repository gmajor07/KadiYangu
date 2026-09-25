import { describe, it, expect } from "vitest";
import { canAccessAdmin, isActive } from "@/lib/permissions";
import { registrationSchema } from "@/lib/validation/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
describe("authorization", () => {
  it("denies ordinary users and missing accounts", () => {
    expect(canAccessAdmin({ role: "USER", status: "ACTIVE" })).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });
  it("allows only active administrators", () => {
    expect(canAccessAdmin({ role: "ADMIN", status: "ACTIVE" })).toBe(true);
    expect(canAccessAdmin({ role: "ADMIN", status: "SUSPENDED" })).toBe(false);
    expect(isActive({ role: "USER", status: "SUSPENDED" })).toBe(false);
  });
});
describe("registration validation", () => {
  const input = {
    name: "Test User",
    email: " TEST@example.com ",
    password: "a long test passphrase",
  };
  it("normalizes email", () =>
    expect(registrationSchema.parse(input).email).toBe("test@example.com"));
  it("rejects privilege injection", () =>
    expect(
      registrationSchema.safeParse({ ...input, role: "ADMIN" }).success,
    ).toBe(false));
  it("rejects short/oversized passwords and invalid email", () => {
    for (const change of [
      { password: "short" },
      { password: "a".repeat(129) },
      { email: "bad" },
    ])
      expect(
        registrationSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
});
it("salts passwords, verifies matches, and rejects wrong or malformed hashes", async () => {
  const first = await hashPassword("correct long passphrase");
  const second = await hashPassword("correct long passphrase");
  expect(first).not.toBe(second);
  expect(first).not.toContain("correct");
  expect(await verifyPassword("correct long passphrase", first)).toBe(true);
  expect(await verifyPassword("wrong", first)).toBe(false);
  expect(await verifyPassword("wrong", "broken")).toBe(false);
  // Real scrypt work intentionally remains expensive, including on a busy CI host.
}, 15000);
