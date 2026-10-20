import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: {} as any, member: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/services/organizations", () => ({ requireOrganizationMember: mocks.member }));
import { activateSubscriptionFromTrustedVerification, createPendingBillingRecord, getOrganizationSubscription } from "@/services/subscriptions";
describe("organization subscription foundation", () => {
  it("never activates without trusted verification", async () => { expect((await activateSubscriptionFromTrustedVerification("billing", false)).ok).toBe(false); });
  it("requires OWNER or BILLING membership to create billing", async () => { mocks.member.mockResolvedValueOnce(null); expect(await createPendingBillingRecord("u", "org", "STARTER", "MONTHLY", "key")).toBeNull(); });
  it("creates a server-calculated pending billing snapshot", async () => {
    mocks.member.mockResolvedValueOnce({ role: "BILLING" });
    mocks.db = { subscriptionPlan: { findFirst: vi.fn().mockResolvedValue({ id: "plan", name: "Starter", monthlyAmount: 1000, annualAmount: 10000, currency: "TZS" }) }, organizationBillingRecord: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ amount: 1000, status: "PENDING" }) } };
    expect(await createPendingBillingRecord("u", "org", "STARTER", "MONTHLY", "key")).toMatchObject({ amount: 1000, status: "PENDING" });
  });
  it("denies billing creation for non-billing roles", async () => {
    for (const role of ["ADMIN", "MANAGER", "EDITOR", "SCANNER"]) {
      mocks.member.mockResolvedValueOnce(null);
      expect(await createPendingBillingRecord("u", "org", "STARTER", "MONTHLY", `key-${role}`)).toBeNull();
    }
  });
  it("allows only subscription-view roles to read organization billing", async () => {
    mocks.db = { organizationSubscription: { findFirst: vi.fn().mockResolvedValue({ organizationId: "org" }) } };
    for (const role of ["OWNER", "ADMIN", "MANAGER", "BILLING"]) {
      mocks.member.mockResolvedValueOnce({ role });
      expect(await getOrganizationSubscription("u", "org")).toMatchObject({ organizationId: "org" });
    }
    mocks.member.mockResolvedValueOnce(null);
    expect(await getOrganizationSubscription("u", "other-org")).toBeNull();
  });
});
