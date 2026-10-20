import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createGuestPassOrder, allocateVerifiedGuestPasses } from "@/services/guest-passes";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("guest-pass allocation database integration", () => {
  it.skipIf(!enabled)("allocates a verified purchase exactly once under concurrent callbacks", async () => {
    const db = getDb();
    const suffix = randomUUID();
    let userId = "";
    let designId = "";
    let eventId = "";
    const orderIds: string[] = [];
    const paymentIds: string[] = [];
    const purchaseIds: string[] = [];
    try {
      const user = await db.user.create({ data: { email: `pass-${suffix}@example.com`, name: "Pass Test", passwordHash: "test", role: "USER", status: "ACTIVE" } });
      userId = user.id;
      const design = await db.design.create({ data: { userId, name: `Pass Design ${suffix}`, width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1 }, status: "DRAFT" } });
      designId = design.id;
      const event = await db.event.create({ data: { userId, designId, title: `Pass Event ${suffix}`, slug: `pass-${suffix}`, eventType: "Other", eventDate: new Date("2035-01-01") } });
      eventId = event.id;
      const order = await createGuestPassOrder(userId, eventId, 173, `idem-${suffix}`);
      expect(order).toBeTruthy();
      if (!order) return;
      orderIds.push(order.id);
      const payment = await db.payment.create({ data: { orderId: order.id, provider: "MANUAL_TEST", amount: order.total, currency: order.currency, status: "SUCCESS", providerReference: `verified-${suffix}` } });
      paymentIds.push(payment.id);
      const results = await Promise.all([allocateVerifiedGuestPasses(payment.id), allocateVerifiedGuestPasses(payment.id)]);
      expect(results.filter((r) => r.ok && !r.idempotent)).toHaveLength(1);
      expect(results.every((r) => r.ok)).toBe(true);
      const purchase = await db.guestPassPurchase.findUniqueOrThrow({ where: { orderId: order.id } });
      purchaseIds.push(purchase.id);
      expect(purchase.quantityIssued).toBe(173);
      expect(purchase.quantityRemaining).toBe(173);
      expect(purchase.status).toBe("ISSUED");
      expect(await db.auditLog.count({ where: { entityId: purchase.id, action: "GUEST_PASS_ALLOCATED" } })).toBe(1);

      const second = await createGuestPassOrder(userId, eventId, 207, `idem-2-${suffix}`);
      expect(second).toBeTruthy();
      if (!second) return;
      orderIds.push(second.id);
      const secondPayment = await db.payment.create({ data: { orderId: second.id, provider: "MANUAL_TEST", amount: second.total, currency: second.currency, status: "PENDING", providerReference: `pending-${suffix}` } });
      paymentIds.push(secondPayment.id);
      const secondPurchase = await db.guestPassPurchase.findUniqueOrThrow({ where: { orderId: second.id } });
      purchaseIds.push(secondPurchase.id);
      const pending = await allocateVerifiedGuestPasses(secondPayment.id);
      expect(pending.ok).toBe(false);
      await db.payment.update({ where: { id: secondPayment.id }, data: { status: "FAILED" } });
      expect((await allocateVerifiedGuestPasses(secondPayment.id)).ok).toBe(false);
      await db.payment.update({ where: { id: secondPayment.id }, data: { status: "SUCCESS", amount: second.total + 1 } });
      expect((await allocateVerifiedGuestPasses(secondPayment.id)).ok).toBe(false);
      await db.payment.update({ where: { id: secondPayment.id }, data: { amount: second.total, currency: "USD" } });
      expect((await allocateVerifiedGuestPasses(secondPayment.id)).ok).toBe(false);
    } finally {
      if (purchaseIds.length) await db.auditLog.deleteMany({ where: { entityId: { in: purchaseIds } } });
      if (paymentIds.length) await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
      if (orderIds.length) await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      if (purchaseIds.length) await db.guestPassPurchase.deleteMany({ where: { id: { in: purchaseIds } } });
      if (orderIds.length) await db.order.deleteMany({ where: { id: { in: orderIds } } });
      if (eventId) await db.event.deleteMany({ where: { id: eventId } });
      if (designId) await db.design.deleteMany({ where: { id: designId } });
      if (userId) await db.user.deleteMany({ where: { id: userId } });
    }
  });
});
