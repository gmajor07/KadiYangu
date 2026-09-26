import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { canPremiumExport, completeTestPayment, createPremiumExportOrder } from "@/services/commerce";

it("test payment completes order and grants one idempotent entitlement", async () => {
  if (process.env.ALLOW_TEST_DATABASE !== "true" || !process.env.DATABASE_URL?.includes("kadiyangu_phase1_test")) throw new Error("Use only the isolated test database");
  process.env.ENABLE_TEST_PAYMENTS = "true";
  const db = getDb(); const userId = randomUUID(); const designId = randomUUID(); const email = `commerce-${randomUUID()}@example.test`;
  try {
    await db.user.create({ data: { id: userId, name: "Commerce Test", email, passwordHash: "test", updatedAt: new Date() } });
    await db.design.create({ data: { id: designId, userId, name: "Commerce design", designData: { version: 1, canvas: { width: 1080, height: 1350, backgroundColor: "#ffffff" }, elements: [] }, width: 1080, height: 1350, orientation: "PORTRAIT" } });
    const order = await createPremiumExportOrder(userId, designId); expect(order?.total).toBe(5000); if (!order) throw new Error("Order was not created");
    expect((await completeTestPayment(userId, order.id, "SUCCESS")).status).toBe("PAID");
    expect(await canPremiumExport(userId, designId)).toBe(true);
    await completeTestPayment(userId, order.id, "SUCCESS");
    expect(await db.entitlement.count({ where: { userId, resourceId: designId } })).toBe(1);
  } finally { await db.entitlement.deleteMany({ where: { userId } }); await db.payment.deleteMany({ where: { order: { userId } } }); await db.order.deleteMany({ where: { userId } }); await db.design.deleteMany({ where: { id: designId } }); await db.user.delete({ where: { id: userId } }); }
});
