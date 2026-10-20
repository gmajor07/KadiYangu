import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createOrganization(userId: string, name: string, type: "AGENCY" | "RESELLER" | "PLANNER" | "BUSINESS" = "AGENCY") {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${randomBytes(3).toString("hex")}`;
  return getDb().organization.create({ data: { name: name.trim().slice(0, 160), slug, type, ownerUserId: userId, members: { create: { userId, role: "OWNER", status: "ACTIVE" } } } });
}

export function listOrganizations(userId: string) {
  return getDb().organization.findMany({ where: { status: "ACTIVE", members: { some: { userId, status: "ACTIVE" } } }, orderBy: { name: "asc" } });
}

export async function requireOrganizationMember(userId: string, organizationId: string, roles?: string[]) {
  const m = await getDb().organizationMember.findFirst({ where: { organizationId, userId, status: "ACTIVE", ...(roles ? { role: { in: roles as any } } : {}) }, include: { organization: true } });
  if (!m || m.organization.status !== "ACTIVE") return null;
  return m;
}

export async function inviteOrganizationMember(userId: string, organizationId: string, email: string, role: any = "EDITOR") {
  const m = await requireOrganizationMember(userId, organizationId, ["OWNER", "ADMIN"]);
  if (!m || role === "OWNER") return null;
  const raw = randomBytes(32).toString("base64url");
  const invitation = await getDb().organizationInvitation.create({ data: { organizationId, email: email.trim().toLowerCase(), role, tokenHash: hash(raw), invitedByUserId: userId, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  return { id: invitation.id, token: raw, expiresAt: invitation.expiresAt };
}

export async function acceptOrganizationInvitation(userId: string, accountEmail: string, rawToken: string) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (!account || account.status !== "ACTIVE") return { ok: false as const, reason: "ACCOUNT_UNAVAILABLE" };
    const invitation = await tx.organizationInvitation.findFirst({ where: { tokenHash: hash(rawToken) }, include: { organization: true } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || invitation.organization.status !== "ACTIVE") return { ok: false as const, reason: "INVALID_INVITATION" };
    if (invitation.email !== accountEmail.trim().toLowerCase()) return { ok: false as const, reason: "EMAIL_MISMATCH" };
    const existing = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId } } });
    if (existing && existing.status !== "INVITED") return { ok: false as const, reason: "ALREADY_MEMBER" };
    const claimed = await tx.organizationInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) return { ok: false as const, reason: "ALREADY_USED" };
    const membership = existing
      ? await tx.organizationMember.update({ where: { id: existing.id }, data: { status: "ACTIVE", role: invitation.role } })
      : await tx.organizationMember.create({ data: { organizationId: invitation.organizationId, userId, role: invitation.role, status: "ACTIVE" } });
    return { ok: true as const, organizationId: invitation.organizationId, membership };
  });
}

export async function listOrganizationTeam(actorId: string, organizationId: string) {
  if (!await requireOrganizationMember(actorId, organizationId)) return null;
  return getDb().organizationMember.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true, status: true } } }, orderBy: { createdAt: "asc" } });
}

export async function updateOrganizationMember(actorId: string, organizationId: string, userId: string, action: "SUSPEND" | "REMOVE" | "ROLE", role?: any) {
  const actor = await requireOrganizationMember(actorId, organizationId, ["OWNER", "ADMIN"]);
  const allowedRoles = ["ADMIN", "MANAGER", "EDITOR", "SCANNER", "BILLING"];
  // Ownership transfer is deliberately a separate workflow. Until it exists,
  // no role-management request can silently create a second OWNER.
  if (!actor || (action === "ROLE" && (!allowedRoles.includes(role) || role === "OWNER"))) return false;
  const target = await getDb().organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!target || target.status !== "ACTIVE" || (target.role === "OWNER" && actor.role !== "OWNER")) return false;
  if ((action === "REMOVE" || action === "SUSPEND") && target.role === "OWNER") {
    const owners = await getDb().organizationMember.count({ where: { organizationId, role: "OWNER", status: "ACTIVE" } });
    if (owners <= 1) return false;
  }
  await getDb().organizationMember.update({ where: { id: target.id }, data: action === "ROLE" ? { role: role === "OWNER" ? target.role : role } : { status: action === "REMOVE" ? "REMOVED" : "SUSPENDED" } });
  return true;
}

export async function removeOrganizationMember(actorId: string, organizationId: string, userId: string) {
  return updateOrganizationMember(actorId, organizationId, userId, "REMOVE");
}
