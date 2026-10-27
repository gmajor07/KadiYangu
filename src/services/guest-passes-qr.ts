import "server-only";
import { scannerEventAccess } from "@/services/scanner";
import { isEntryPassToken } from "@/lib/scanner/contracts";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { canManageEvent } from "@/services/events";
import { requireOrganizationMember } from "@/services/organizations";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const token = () => randomBytes(32).toString("base64url");

export async function issueGuestPasses(userId: string, eventId: string, quantity: number, purchaseId: string) {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const db = getDb();
  if (!await canManageEvent(userId, eventId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return null;
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) return null;
    const purchase = await tx.guestPassPurchase.findFirst({ where: { id: purchaseId, eventId, status: "ISSUED" }, select: { id: true, quantityPurchased: true, quantityIssued: true, quantityRemaining: true } });
    if (!purchase || quantity > purchase.quantityRemaining) return null;
    const rows = Array.from({ length: quantity }, () => { const raw = token(); return { eventId, purchaseId, tokenHash: hash(raw), raw }; });
    await tx.guestPassPurchase.update({ where: { id: purchase.id }, data: { quantityIssued: { increment: quantity }, quantityRemaining: { decrement: quantity } } });
    await tx.guestPass.createMany({ data: rows.map(({ eventId, purchaseId, tokenHash }) => ({ eventId, purchaseId, tokenHash })) });
    return rows.map(({ raw, ...r }) => ({ ...r, token: raw }));
  });
}

/** Issues passes from a beta grant without creating an order, payment, or paid entitlement. */
export async function issueBetaGuestPasses(userId: string, eventId: string, quantity: number, idempotencyKey: string) {
  if (!Number.isInteger(quantity) || quantity < 1 || !idempotencyKey || idempotencyKey.length > 120) return null;
  if (!await canManageEvent(userId, eventId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return null;
  const db = getDb();
  const run = () => db.$transaction(async (tx) => {
    const existing = await tx.guestPassPurchase.findUnique({ where: { idempotencyKey }, select: { id: true, quantityIssued: true, status: true } });
    if (existing) {
      const matches = await tx.guestPassPurchase.findFirst({ where: { id: existing.id, eventId, quantityPurchased: quantity, status: "BETA_ISSUED" }, select: { id: true } });
      return matches ? { passes: [], idempotent: true, purchaseId: existing.id } : null;
    }
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, organizationId: true } });
    if (!event) return null;
    if (event.organizationId && !await requireOrganizationMember(userId, event.organizationId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return null;
    const cfg = await tx.betaConfiguration.findUnique({ where: { id: "default" }, select: { enabled: true } });
    if (!cfg?.enabled) return null;
    const grant = event.organizationId
      ? await tx.betaGrant.findUnique({ where: { organizationId_grantType: { organizationId: event.organizationId, grantType: "BETA_GRANT" } }, select: { id: true, expiresAt: true, guestPassLimit: true, guestPassesUsed: true } })
      : await tx.betaGrant.findUnique({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } }, select: { id: true, expiresAt: true, guestPassLimit: true, guestPassesUsed: true } });
    if (!grant || grant.expiresAt <= new Date()) return null;
    const consumed = await tx.betaGrant.updateMany({ where: { id: grant.id, expiresAt: { gt: new Date() }, guestPassesUsed: { lte: grant.guestPassLimit - quantity } }, data: { guestPassesUsed: { increment: quantity } } });
    if (!consumed.count) return null;
    const purchase = await tx.guestPassPurchase.create({ data: { eventId, betaGrantId: grant.id, quantityPurchased: quantity, quantityIssued: quantity, quantityRemaining: quantity, unitAmount: 0, totalAmount: 0, currency: "TZS", status: "BETA_ISSUED", idempotencyKey }, select: { id: true } });
    const rows = Array.from({ length: quantity }, () => { const raw = token(); return { eventId, purchaseId: purchase.id, tokenHash: hash(raw), raw }; });
    await tx.guestPass.createMany({ data: rows.map(({ eventId, purchaseId, tokenHash }) => ({ eventId, purchaseId, tokenHash })) });
    return { passes: rows.map(({ raw, ...r }) => ({ ...r, token: raw })), idempotent: false, purchaseId: purchase.id };
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = String((error as { message?: string })?.message || "").toLowerCase();
      const transient = code === "P2034" || (code === "P2002" && message.includes("idempotencykey")) || message.includes("serialization failure") || message.includes("deadlock detected");
      if (!transient || attempt === 3) return null;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1) + Math.floor(Math.random() * 30)));
    }
  }
  return null;
}

export async function checkInGuestPass(userId: string, eventId: string, rawToken: string) {
  if (!isEntryPassToken(rawToken)) return { ok: false as const, reason: "INVALID" };
  const db = getDb();
  return db.$transaction(async (tx) => {
    const allowed = await tx.event.findFirst({ where: { AND: [{ id: eventId }, scannerEventAccess(userId)] }, select: { id: true } });
    if (!allowed) return { ok: false as const, reason: "UNAUTHORIZED" };
    // Use the same advisory lock key as replacement to make the race deterministic.
    const candidate = await tx.guestPass.findUnique({ where: { tokenHash: hash(rawToken) }, select: { id: true } });
    if (candidate) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${candidate.id}, 0))`;
    const pass = await tx.guestPass.findUnique({ where: { tokenHash: hash(rawToken) } });
    if (!pass) return { ok: false as const, reason: "INVALID" };
    if (pass.eventId !== eventId) return { ok: false as const, reason: "INVALID", detail: "WRONG_EVENT" };
    const entry = { guestName: pass.guestName, allowedEntries: 1 as const, checkedIn: 1 as const, remaining: 0 as const };
    if (pass.status === "REVOKED") return { ok: false as const, reason: "REVOKED" };
    if (pass.status === "CHECKED_IN") return { ok: false as const, reason: "ALREADY_USED", entry };
    const updated = await tx.guestPass.updateMany({ where: { id: pass.id, status: "ACTIVE" }, data: { status: "CHECKED_IN", checkedInAt: new Date() } });
    if (!updated.count) return { ok: false as const, reason: "ALREADY_USED" };
    await tx.checkIn.create({ data: { passId: pass.id, eventId, scannerUserId: userId, result: "APPROVED" } });
    return { ok: true as const, passId: pass.id, entry };
  });
}

export async function revokeGuestPass(userId: string, passId: string) {
  const db = getDb();
  const pass = await db.guestPass.findUnique({ where: { id: passId }, select: { eventId: true } });
  if (!pass || !await canManageEvent(userId, pass.eventId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return { count: 0 };
  return db.guestPass.updateMany({ where: { id: passId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
}
export async function assignGuestPass(userId: string, passId: string, guestId: string) {
  const db = getDb();
  const pass = await db.guestPass.findUnique({ where: { id: passId }, select: { id: true, eventId: true, status: true, guestName: true } });
  if (!pass || pass.status !== "ACTIVE" || pass.guestName || !await canManageEvent(userId, pass.eventId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return false;
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: pass.eventId }, select: { name: true, email: true, phone: true } });
  if (!guest) return false;
  const updated = await db.guestPass.updateMany({ where: { id: pass.id, status: "ACTIVE", guestName: null }, data: { guestName: guest.name, guestEmail: guest.email, guestPhone: guest.phone } });
  return updated.count === 1;
}

export async function replaceGuestPassToken(userId: string, passId: string, expectedRevision = 0) {
  const db = getDb();
  const accessPass = await db.guestPass.findUnique({ where: { id: passId }, select: { eventId: true } });
  if (!accessPass || !await canManageEvent(userId, accessPass.eventId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return null;
  try { return await db.$transaction(async (tx) => {
    // Serialize replacement/check-in mutations for this pass at the PostgreSQL level.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${passId}, 0))`;
    const pass = await tx.guestPass.findFirst({ where: { id: passId, status: "ACTIVE", checkedInAt: null, replacementRevision: expectedRevision }, select: { id: true, eventId: true, purchaseId: true, tokenHash: true, replacementRevision: true } });
    if (!pass) return null;
    const raw = token();
    const updated = await tx.guestPass.updateMany({ where: { id: pass.id, status: "ACTIVE", checkedInAt: null, tokenHash: pass.tokenHash, replacementRevision: expectedRevision }, data: { tokenHash: hash(raw), replacementRevision: { increment: 1 } } });
    if (!updated.count) return null;
    await tx.auditLog.create({ data: { action: "GUEST_PASS_TOKEN_REPLACED", entityType: "GuestPass", entityId: pass.id, afterData: { eventId: pass.eventId, purchaseId: pass.purchaseId } } });
    return { passId: pass.id, token: raw, revision: expectedRevision + 1 };
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 }); } catch (error) { if ((error as { code?: string })?.code === "P2034") return null; throw error; }
}
