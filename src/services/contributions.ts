import "server-only";
import { getDb } from "@/lib/db";
import { canManageEvent } from "@/services/events";

const roles = ["OWNER", "ADMIN", "MANAGER", "EDITOR"];
const positive = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
async function allowed(userId: string, eventId: string) { return canManageEvent(userId, eventId, roles); }
export async function listContributors(userId: string, eventId: string, query = "") {
  if (!await allowed(userId, eventId)) return null;
  return getDb().eventContributor.findMany({ where: { eventId, ...(query ? { fullName: { contains: query, mode: "insensitive" } } : {}) }, include: { pledges: true, payments: { orderBy: { paymentDate: "desc" } }, guest: { select: { id: true, name: true } } }, orderBy: { fullName: "asc" } });
}
export async function createContributor(userId: string, eventId: string, input: { fullName: string; phone?: string; email?: string; notes?: string; guestId?: string }) {
  if (!await allowed(userId, eventId) || !input.fullName.trim()) return null;
  if (input.guestId && !(await getDb().guest.findFirst({ where: { id: input.guestId, eventId }, select: { id: true } }))) return null;
  try { const row = await getDb().eventContributor.create({ data: { eventId, guestId: input.guestId || null, fullName: input.fullName.trim(), phone: input.phone || null, email: input.email || null, notes: input.notes || null } }); await audit(userId, "CONTRIBUTOR_CREATED", row.id); return row; } catch { return null; }
}
export async function createPledge(userId: string, eventId: string, contributorId: string, amount: unknown, dueDate?: string, notes?: string) {
  const value = positive(amount); if (!value || !await allowed(userId, eventId)) return null;
  const contributor = await getDb().eventContributor.findFirst({ where: { id: contributorId, eventId }, select: { id: true } }); if (!contributor) return null;
  const row = await getDb().contributionPledge.create({ data: { contributorId, amount: value, dueDate: dueDate ? new Date(dueDate) : null, notes: notes || null } }); await audit(userId, "PLEDGE_CREATED", row.id); return row;
}
export async function updateContributor(userId: string, eventId: string, contributorId: string, input: { fullName: string; phone?: string; email?: string; notes?: string }) {
  if (!await allowed(userId, eventId) || !input.fullName.trim()) return null;
  const existing = await getDb().eventContributor.findFirst({ where: { id: contributorId, eventId }, select: { id: true } }); if (!existing) return null;
  const row = await getDb().eventContributor.update({ where: { id: contributorId }, data: { fullName: input.fullName.trim(), phone: input.phone || null, email: input.email || null, notes: input.notes || null } }); await audit(userId, "CONTRIBUTOR_UPDATED", row.id); return row;
}
export async function updatePledge(userId: string, eventId: string, pledgeId: string, input: { amount: unknown; dueDate?: string; notes?: string; status?: "OPEN"|"PARTIALLY_PAID"|"PAID"|"CANCELLED" }) {
  const amount = positive(input.amount); if (!amount || !await allowed(userId, eventId)) return null;
  const pledge = await getDb().contributionPledge.findFirst({ where: { id: pledgeId, contributor: { eventId } }, select: { id: true } }); if (!pledge) return null;
  const row = await getDb().contributionPledge.update({ where: { id: pledgeId }, data: { amount, dueDate: input.dueDate ? new Date(input.dueDate) : null, notes: input.notes || null, ...(input.status ? { status: input.status } : {}) } }); await audit(userId, "PLEDGE_UPDATED", row.id); return row;
}
export async function recordContributionPayment(userId: string, eventId: string, input: { contributorId: string; pledgeId?: string; amount: unknown; method: "CASH"|"MPESA"|"MIXX_BY_YAS"|"AIRTEL_MONEY"|"BANK_TRANSFER"|"OTHER"; referenceNumber?: string; notes?: string }) {
  const value = positive(input.amount); if (!value || !await allowed(userId, eventId)) return null;
  const contributor = await getDb().eventContributor.findFirst({ where: { id: input.contributorId, eventId }, select: { id: true } }); if (!contributor) return null;
  if (input.pledgeId && !(await getDb().contributionPledge.findFirst({ where: { id: input.pledgeId, contributorId: input.contributorId }, select: { id: true } }))) return null;
  if (input.referenceNumber?.trim() && await getDb().contributionPayment.findFirst({ where: { contributorId: input.contributorId, referenceNumber: input.referenceNumber.trim() }, select: { id: true } })) return null;
  const row = await getDb().contributionPayment.create({ data: { contributorId: input.contributorId, pledgeId: input.pledgeId || null, amount: value, method: input.method, referenceNumber: input.referenceNumber || null, notes: input.notes || null, recordedByUserId: userId } }); await audit(userId, "CONTRIBUTION_PAYMENT_RECORDED", row.id); return row;
}
export async function updatePaymentVerification(userId: string, eventId: string, paymentId: string, status: "CONFIRMED"|"REJECTED"|"REVERSED") {
  if (!await allowed(userId, eventId)) return null; const payment = await getDb().contributionPayment.findFirst({ where: { id: paymentId, contributor: { eventId } }, select: { id: true } }); if (!payment) return null; const row = await getDb().contributionPayment.update({ where: { id: payment.id }, data: { verificationStatus: status } }); await audit(userId, `CONTRIBUTION_PAYMENT_${status}`, row.id); return row;
}
export async function reverseContributionPayment(userId: string, eventId: string, paymentId: string, reason: string) {
  if (!reason.trim() || !await allowed(userId, eventId)) return null;
  const payment = await getDb().contributionPayment.findFirst({ where: { id: paymentId, contributor: { eventId } }, select: { id: true, verificationStatus: true, notes: true } }); if (!payment || payment.verificationStatus === "REVERSED") return null;
  const row = await getDb().contributionPayment.update({ where: { id: payment.id }, data: { verificationStatus: "REVERSED", notes: `${payment.notes ? `${payment.notes}\n` : ""}Reversal: ${reason.trim()}` } }); await audit(userId, "CONTRIBUTION_PAYMENT_REVERSED", row.id); return row;
}
export async function contributionSummary(userId: string, eventId: string) {
  if (!await allowed(userId, eventId)) return null; const rows = await getDb().eventContributor.findMany({ where: { eventId }, include: { pledges: { where: { status: { not: "CANCELLED" } }, select: { amount: true } }, payments: { select: { amount: true, verificationStatus: true } } } });
  let pledged = 0, confirmed = 0, pending = 0, fullyPaid = 0, partiallyPaid = 0, unpaid = 0; for (const row of rows) { const p = row.pledges.reduce((n, x) => n + x.amount, 0), paid = row.payments.filter(x => x.verificationStatus === "CONFIRMED").reduce((n, x) => n + x.amount, 0); pending += row.payments.filter(x => x.verificationStatus === "PENDING").length; pledged += p; confirmed += paid; if (p > 0 && paid >= p) fullyPaid++; else if (paid > 0) partiallyPaid++; else unpaid++; }
  return { totalContributors: rows.length, totalPledged: pledged, totalConfirmed: confirmed, outstanding: Math.max(pledged - confirmed, 0), overpaid: Math.max(confirmed - pledged, 0), fullyPaid, partiallyPaid, unpaid, pendingPaymentCount: pending };
}
export type ContributionReportFilters = { query?: string; status?: "ALL"|"PAID"|"PARTIAL"|"UNPAID"; method?: string; from?: Date; to?: Date; page?: number; pageSize?: number; sort?: "name"|"pledged"|"paid"|"outstanding"|"latest" };
export async function contributionReport(userId: string, eventId: string, filters: ContributionReportFilters = {}) {
  if (!await allowed(userId, eventId)) return null;
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25)); const page = Math.max(1, filters.page ?? 1);
  const rows = await getDb().eventContributor.findMany({ where: { eventId, ...(filters.query ? { OR: [{ fullName: { contains: filters.query, mode: "insensitive" } }, { phone: { contains: filters.query } }] } : {}) }, include: { pledges: { where: { status: { not: "CANCELLED" } }, select: { amount: true } }, payments: { where: { ...(filters.method && filters.method !== "ALL" ? { method: filters.method as never } : {}), ...(filters.from || filters.to ? { paymentDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) }, select: { amount: true, method: true, verificationStatus: true, paymentDate: true } }, guest: { select: { id: true, name: true } } }, orderBy: { fullName: "asc" } });
  const mapped = rows.map(row => { const pledged = row.pledges.reduce((n, p) => n + p.amount, 0); const confirmed = row.payments.filter(p => p.verificationStatus === "CONFIRMED"); const paid = confirmed.reduce((n, p) => n + p.amount, 0); const outstanding = Math.max(pledged - paid, 0); const status = pledged > 0 && paid >= pledged ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID"; return { id: row.id, fullName: row.fullName, phone: row.phone, guest: row.guest, pledged, paid, outstanding, overpaid: Math.max(paid - pledged, 0), status, lastPaymentDate: confirmed.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0]?.paymentDate ?? null, paymentMethods: [...new Set(row.payments.map(p => p.method))] }; }).filter(row => !filters.status || filters.status === "ALL" || row.status === filters.status);
  const sort = filters.sort || "name"; mapped.sort((a, b) => sort === "pledged" ? b.pledged - a.pledged : sort === "paid" ? b.paid - a.paid : sort === "outstanding" ? b.outstanding - a.outstanding : sort === "latest" ? (b.lastPaymentDate?.getTime() || 0) - (a.lastPaymentDate?.getTime() || 0) : a.fullName.localeCompare(b.fullName));
  return { rows: mapped.slice((page - 1) * pageSize, page * pageSize), total: mapped.length, page, pageSize, pages: Math.max(1, Math.ceil(mapped.length / pageSize)) };
}
export function contributionAnalytics(rows: Array<{ pledged: number; paid: number; status: string; paymentMethods: string[]; lastPaymentDate: Date | null }>) { const methods: Record<string, number> = {}; const trend: Record<string, number> = {}; for (const row of rows) { for (const method of row.paymentMethods) methods[method] = (methods[method] || 0) + 1; if (row.lastPaymentDate) { const key = row.lastPaymentDate.toISOString().slice(0, 10); trend[key] = (trend[key] || 0) + row.paid; } } return { methods, trend, pledged: rows.reduce((n, r) => n + r.pledged, 0), paid: rows.reduce((n, r) => n + r.paid, 0), statuses: rows.reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}) }; }
async function audit(actorUserId: string, action: string, entityId: string) { await getDb().auditLog.create({ data: { actorUserId, action, entityType: "Contribution", entityId } }); }
