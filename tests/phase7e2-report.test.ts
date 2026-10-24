import { describe, expect, it } from "vitest";
import { contributionAnalytics } from "@/services/contributions";
describe("Phase 7E.2 reporting", () => {
  it("aggregates confirmed rows by status, method and date", () => {
    const result = contributionAnalytics([{ pledged: 100, paid: 40, status: "PARTIAL", paymentMethods: ["CASH"], lastPaymentDate: new Date("2026-01-02") }, { pledged: 50, paid: 50, status: "PAID", paymentMethods: ["MPESA"], lastPaymentDate: new Date("2026-01-02") }]);
    expect(result).toMatchObject({ pledged: 150, paid: 90, methods: { CASH: 1, MPESA: 1 }, statuses: { PARTIAL: 1, PAID: 1 }, trend: { "2026-01-02": 90 } });
  });
  it("returns empty analytics safely", () => expect(contributionAnalytics([])).toEqual({ methods: {}, trend: {}, pledged: 0, paid: 0, statuses: {} }));
});
