import "server-only";
import { getDb } from "@/lib/db";
export async function getAdminOverview() {
  const db = getDb();
  const [customers, categories, publishedTemplates, designs, events, guests, rsvps, orders, paidOrders, revenue, pendingPayments, failedPayments, recentOrders, recentPayments] = await Promise.all([
    db.user.count({ where: { role: "USER" } }),
    db.eventCategory.count(),
    db.template.count({ where: { status: "PUBLISHED", isActive: true, category: { isActive: true } } }),
    db.design.count(), db.event.count(), db.guest.count(), db.rsvp.count(), db.order.count(),
    db.order.count({ where: { status: "PAID" } }),
    db.order.aggregate({ where: { status: "PAID" }, _sum: { total: true } }),
    db.payment.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    db.payment.count({ where: { status: "FAILED" } }),
    db.order.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, total: true, currency: true, status: true, createdAt: true, user: { select: { email: true } } } }),
    db.payment.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id: true, amount: true, currency: true, provider: true, status: true, createdAt: true, order: { select: { orderNumber: true } } } }),
  ]);
  return { metrics: { customers, categories, publishedTemplates, designs, events, guests, rsvps, orders, paidOrders, revenue: revenue._sum.total || 0, pendingPayments, failedPayments }, recentOrders, recentPayments };
}
