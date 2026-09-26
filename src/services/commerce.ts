import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
export const PREMIUM_EXPORT_PRICE = 5000;
export async function createPremiumExportOrder(userId: string, designId: string) { const design = await getDb().design.findFirst({ where: { id: designId, userId }, select: { id: true } }); if (!design) return null; return getDb().order.create({ data: { userId, designId, orderNumber: `KY-${randomUUID().slice(0, 8).toUpperCase()}`, type: "DESIGN_EXPORT", currency: "TZS", subtotal: PREMIUM_EXPORT_PRICE, total: PREMIUM_EXPORT_PRICE }, select: { id: true, orderNumber: true, total: true, currency: true, status: true } }); }
export function listOrders(userId: string) { return getDb().order.findMany({ where: { userId }, include: { design: { select: { name: true } } }, orderBy: { createdAt: "desc" } }); }
export function listAllOrders() { return getDb().order.findMany({ include: { user: { select: { name: true, email: true } }, payments: true }, orderBy: { createdAt: "desc" } }); }
export function listAllPayments() { return getDb().payment.findMany({ include: { order: { include: { user: { select: { name: true, email: true } } } } }, orderBy: { createdAt: "desc" } }); }
export async function canPremiumExport(userId: string, designId: string) { const entitlement = await getDb().entitlement.findFirst({ where: { userId, resourceType: "DESIGN", resourceId: designId, capability: "PREMIUM_EXPORT", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }); return Boolean(entitlement); }
