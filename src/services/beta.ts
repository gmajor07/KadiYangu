import "server-only";
import { getDb } from "@/lib/db";
import { requireOrganizationMember } from "@/services/organizations";
export async function getBetaConfiguration() { return getDb().betaConfiguration.findUnique({ where: { id: "default" } }); }
/** Idempotently provisions the configured personal beta grant; never creates organization grants. */
export async function claimPersonalBeta(userId: string) {
  const db = getDb();
  const config = await db.betaConfiguration.findUnique({ where: { id: "default" } });
  if (!config?.enabled) return null;
  const expiresAt = config.personalExpiresAt ?? new Date(Date.now() + 30 * 86400000);
  if (expiresAt <= new Date()) return null;
  const data = { expiresAt, designLimit: config.personalDesignLimit, eventLimit: config.personalEventLimit, guestPassLimit: config.personalGuestPassLimit };
  try {
    return await db.betaGrant.upsert({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } }, update: {}, create: { userId, grantType: "BETA_GRANT", ...data } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return db.betaGrant.findUnique({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } } });
    throw error;
  }
}
export async function hasBetaAccess(userId: string, organizationId?: string) {
  const db = getDb();
  const cfg = await getBetaConfiguration();
  if (!cfg?.enabled) return false;
  if (organizationId && !await requireOrganizationMember(userId, organizationId)) return false;
  const grant = organizationId
    ? await db.betaGrant.findUnique({ where: { organizationId_grantType: { organizationId, grantType: "BETA_GRANT" } } })
    : await db.betaGrant.findUnique({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } } });
  return Boolean(grant && grant.expiresAt > new Date());
}
export async function grantBetaAccess(actorIsAdmin: boolean, targetUserId: string | null, organizationId: string | null, expiresAt: Date, limits: { designLimit: number; eventLimit: number; guestPassLimit: number }) { if (!actorIsAdmin || (!targetUserId && !organizationId) || (targetUserId && organizationId) || expiresAt <= new Date() || Object.values(limits).some((value) => !Number.isInteger(value) || value < 0)) return null; const db = getDb(); return db.betaGrant.upsert({ where: targetUserId ? { userId_grantType: { userId: targetUserId, grantType: "BETA_GRANT" } } : { organizationId_grantType: { organizationId: organizationId!, grantType: "BETA_GRANT" } }, update: { expiresAt, ...limits }, create: { userId: targetUserId, organizationId, grantType: "BETA_GRANT", expiresAt, ...limits } }); }
export async function submitFeedback(userId: string, organizationId: string | null, rating: number, message: string, contactAllowed: boolean) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || message.trim().length < 5 || message.length > 2000) return null;
  const db = getDb();
  if (organizationId && !await requireOrganizationMember(userId, organizationId)) return null;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`feedback:${userId}`}, 0))`;
    const recent = await tx.feedback.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= 3) return null;
    return tx.feedback.create({ data: { userId, organizationId, rating, message: message.trim(), contactAllowed } });
  });
}

export async function consumeBetaQuota(userId: string, organizationId: string | null, kind: "DESIGN" | "EVENT" | "GUEST_PASS", amount = 1): Promise<boolean | null> {
  if (!Number.isInteger(amount) || amount < 1) return false;
  const db = getDb();
  const cfg = await getBetaConfiguration();
  if (!cfg?.enabled) return null;
  const grant = organizationId
    ? await db.betaGrant.findUnique({ where: { organizationId_grantType: { organizationId, grantType: "BETA_GRANT" } } })
    : await db.betaGrant.findUnique({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } } });
  if (!grant || grant.expiresAt <= new Date()) return null;
  const limitField = kind === "DESIGN" ? "designLimit" : kind === "EVENT" ? "eventLimit" : "guestPassLimit";
  const usedField = kind === "DESIGN" ? "designsUsed" : kind === "EVENT" ? "eventsUsed" : "guestPassesUsed";
  const result = await db.betaGrant.updateMany({ where: { id: grant.id, expiresAt: { gt: new Date() }, [usedField]: { lte: (grant as any)[limitField] - amount } }, data: { [usedField]: { increment: amount } } });
  return result.count === 1;
}
export async function getBetaSummary(userId: string, organizationId?: string | null) {
  const cfg = await getBetaConfiguration();
  if (!cfg?.enabled) return null;
  const db = getDb();
  const grant = organizationId
    ? await db.betaGrant.findUnique({ where: { organizationId_grantType: { organizationId, grantType: "BETA_GRANT" } } })
    : await db.betaGrant.findUnique({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } } });
  if (!grant || grant.expiresAt <= new Date()) return null;
  return { expiresAt: grant.expiresAt, designsRemaining: Math.max(0, grant.designLimit - grant.designsUsed), eventsRemaining: Math.max(0, grant.eventLimit - grant.eventsUsed), guestPassesRemaining: Math.max(0, grant.guestPassLimit - grant.guestPassesUsed) };
}
