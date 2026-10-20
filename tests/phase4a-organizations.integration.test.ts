import { describe, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { acceptOrganizationInvitation, createOrganization, inviteOrganizationMember, listOrganizations, removeOrganizationMember, requireOrganizationMember, updateOrganizationMember } from "@/services/organizations";
import { canManageEvent, createEvent } from "@/services/events";
import { createBlankDesign, getOwnedDesign } from "@/services/designs";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 4A organization database integration", () => {
  it.skipIf(!enabled)("enforces membership, roles, invitations and tenant isolation", async () => {
    const db = getDb();
    const suffix = randomUUID();
    let ownerId = "";
    let memberId = "";
    let outsiderId = "";
    let organizationId = "";
    let secondOrganizationId = "";
    const invitationIds: string[] = [];

    try {
      const owner = await db.user.create({ data: { name: `Phase 4A Owner ${suffix}`, email: `phase4a-owner-${suffix}@example.com`, passwordHash: "integration-test" } });
      ownerId = owner.id;
      const member = await db.user.create({ data: { name: `Phase 4A Member ${suffix}`, email: `phase4a-member-${suffix}@example.com`, passwordHash: "integration-test" } });
      memberId = member.id;
      const outsider = await db.user.create({ data: { name: `Phase 4A Outsider ${suffix}`, email: `phase4a-outsider-${suffix}@example.com`, passwordHash: "integration-test" } });
      outsiderId = outsider.id;

      const organization = await createOrganization(ownerId, `Integration Workspace ${suffix}`, "AGENCY");
      organizationId = organization.id;
      expect(organization.ownerUserId).toBe(ownerId);
      const ownerMembership = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: ownerId } },
      });
      expect(ownerMembership?.role).toBe("OWNER");
      expect(ownerMembership?.status).toBe("ACTIVE");
      expect((await requireOrganizationMember(ownerId, organizationId))?.role).toBe("OWNER");
      expect(await requireOrganizationMember(outsiderId, organizationId)).toBeNull();
      expect((await listOrganizations(ownerId)).some((item) => item.id === organizationId)).toBe(true);
      expect((await listOrganizations(outsiderId)).some((item) => item.id === organizationId)).toBe(false);

      const invite = await inviteOrganizationMember(ownerId, organizationId, member.email, "EDITOR");
      expect(invite).not.toBeNull();
      if (!invite) return;
      invitationIds.push(invite.id);
      const stored = await db.organizationInvitation.findUniqueOrThrow({ where: { id: invite.id } });
      expect(stored.tokenHash).toBe(createHash("sha256").update(invite.token).digest("hex"));
      expect(stored.tokenHash).not.toBe(invite.token);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());

      await db.organizationMember.create({ data: { organizationId, userId: memberId, role: "EDITOR", status: "ACTIVE" } });
      expect((await requireOrganizationMember(memberId, organizationId))?.role).toBe("EDITOR");
      await db.organizationMember.updateMany({ where: { organizationId, userId: memberId }, data: { status: "SUSPENDED" } });
      expect(await requireOrganizationMember(memberId, organizationId)).toBeNull();
      await db.organizationMember.updateMany({ where: { organizationId, userId: memberId }, data: { status: "ACTIVE" } });

      const second = await createOrganization(ownerId, `Second Workspace ${suffix}`, "PLANNER");
      secondOrganizationId = second.id;
      expect(await requireOrganizationMember(ownerId, secondOrganizationId)).not.toBeNull();
      expect(await requireOrganizationMember(memberId, secondOrganizationId)).toBeNull();
      expect(await removeOrganizationMember(ownerId, organizationId, ownerId)).toBe(false);
      expect(await removeOrganizationMember(ownerId, organizationId, memberId)).toBe(true);
      expect(await requireOrganizationMember(memberId, organizationId)).toBeNull();

      await db.organizationInvitation.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      const expired = await db.organizationInvitation.findUniqueOrThrow({ where: { id: invite.id } });
      expect(expired.expiresAt.getTime()).toBeLessThan(Date.now());
      expect(expired.acceptedAt).toBeNull();
    } finally {
      if (invitationIds.length) await db.organizationInvitation.deleteMany({ where: { id: { in: invitationIds } } });
      for (const id of [organizationId, secondOrganizationId]) if (id) await db.organizationMember.deleteMany({ where: { organizationId: id } });
      for (const id of [organizationId, secondOrganizationId]) if (id) await db.organization.deleteMany({ where: { id } });
      for (const id of [ownerId, memberId, outsiderId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });
});

  it.skipIf(!enabled)("verifies invitation acceptance races, account checks and team authorization", async () => {
    const db = getDb();
    const suffix = randomUUID();
    let ownerId = "";
    let memberId = "";
    let wrongId = "";
    let inactiveId = "";
    let organizationId = "";
    const invitationIds: string[] = [];
    try {
      const owner = await db.user.create({ data: { name: "4A2 Owner", email: `4a2-owner-${suffix}@example.com`, passwordHash: "test" } });
      ownerId = owner.id;
      const member = await db.user.create({ data: { name: "4A2 Member", email: `4a2-member-${suffix}@example.com`, passwordHash: "test" } });
      memberId = member.id;
      const wrong = await db.user.create({ data: { name: "4A2 Wrong", email: `4a2-wrong-${suffix}@example.com`, passwordHash: "test" } });
      wrongId = wrong.id;
      const inactive = await db.user.create({ data: { name: "4A2 Inactive", email: `4a2-inactive-${suffix}@example.com`, passwordHash: "test", status: "SUSPENDED" } });
      inactiveId = inactive.id;
      const organization = await createOrganization(ownerId, `4A2 Workspace ${suffix}`);
      organizationId = organization.id;

      const valid = await inviteOrganizationMember(ownerId, organizationId, member.email, "EDITOR");
      expect(valid).not.toBeNull();
      if (!valid) return;
      invitationIds.push(valid.id);
      const accepted = await acceptOrganizationInvitation(memberId, member.email, valid.token);
      expect(accepted.ok).toBe(true);
      expect((await requireOrganizationMember(memberId, organizationId))?.status).toBe("ACTIVE");
      expect((await acceptOrganizationInvitation(memberId, member.email, valid.token)).ok).toBe(false);
      expect(await updateOrganizationMember(ownerId, organizationId, memberId, "ROLE", "MANAGER")).toBe(true);
      expect(await updateOrganizationMember(ownerId, organizationId, memberId, "ROLE", "EDITOR")).toBe(true);

      const wrongInvite = await inviteOrganizationMember(ownerId, organizationId, wrong.email, "EDITOR");
      expect(wrongInvite).not.toBeNull();
      if (!wrongInvite) return;
      invitationIds.push(wrongInvite.id);
      expect((await acceptOrganizationInvitation(wrongId, wrong.email + ".bad", wrongInvite.token)).reason).toBe("EMAIL_MISMATCH");
      await db.organizationInvitation.update({ where: { id: wrongInvite.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
      expect((await acceptOrganizationInvitation(wrongId, wrong.email, wrongInvite.token)).reason).toBe("INVALID_INVITATION");

      const race = await inviteOrganizationMember(ownerId, organizationId, wrong.email, "EDITOR");
      expect(race).not.toBeNull();
      if (!race) return;
      invitationIds.push(race.id);
      const results = await Promise.all([
        acceptOrganizationInvitation(wrongId, wrong.email, race.token),
        acceptOrganizationInvitation(wrongId, wrong.email, race.token),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toHaveLength(1);

      const inactiveInvite = await inviteOrganizationMember(ownerId, organizationId, inactive.email, "EDITOR");
      expect(inactiveInvite).not.toBeNull();
      if (!inactiveInvite) return;
      invitationIds.push(inactiveInvite.id);
      expect((await acceptOrganizationInvitation(inactiveId, inactive.email, inactiveInvite.token)).reason).toBe("ACCOUNT_UNAVAILABLE");
      expect((await acceptOrganizationInvitation(wrongId, wrong.email, "invalid-token-value")).ok).toBe(false);

      expect(await updateOrganizationMember(memberId, organizationId, ownerId, "SUSPEND")).toBe(false);
      expect(await updateOrganizationMember(memberId, organizationId, ownerId, "ROLE", "ADMIN")).toBe(false);
      expect(await updateOrganizationMember(ownerId, organizationId, memberId, "ROLE", "OWNER")).toBe(false);
      await db.organizationMember.update({ where: { organizationId_userId: { organizationId, userId: memberId } }, data: { role: "ADMIN", status: "ACTIVE" } });
      expect(await updateOrganizationMember(memberId, organizationId, ownerId, "ROLE", "EDITOR")).toBe(false);
      expect(await updateOrganizationMember(wrongId, organizationId, ownerId, "ROLE", "EDITOR")).toBe(false);
      expect(await updateOrganizationMember(ownerId, organizationId, memberId, "SUSPEND")).toBe(true);
      expect(await requireOrganizationMember(memberId, organizationId)).toBeNull();
    } finally {
      if (invitationIds.length) await db.organizationInvitation.deleteMany({ where: { id: { in: invitationIds } } });
      if (organizationId) await db.organizationMember.deleteMany({ where: { organizationId } });
      if (organizationId) await db.organization.deleteMany({ where: { id: organizationId } });
      for (const id of [ownerId, memberId, wrongId, inactiveId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });

  it.skipIf(!enabled)("enforces organization resource isolation and role permissions", async () => {
    const db = getDb(); const suffix = randomUUID();
    let ownerId = "", memberId = "", scannerId = "", billingId = "", otherId = "", organizationId = "", otherOrganizationId = "", designId = "", eventId = "", personalDesignId = "";
    try {
      const makeUser = (label: string) => db.user.create({ data: { name: `4A6 ${label}`, email: `4a6-${label.toLowerCase()}-${suffix}@example.com`, passwordHash: "test" } });
      ownerId = (await makeUser("Owner")).id; memberId = (await makeUser("Member")).id; scannerId = (await makeUser("Scanner")).id; billingId = (await makeUser("Billing")).id; otherId = (await makeUser("Other")).id;
      organizationId = (await createOrganization(ownerId, `4A6 Workspace ${suffix}`)).id; otherOrganizationId = (await createOrganization(otherId, `4A6 Other ${suffix}`)).id;
      await db.organizationMember.createMany({ data: [{ organizationId, userId: memberId, role: "EDITOR", status: "ACTIVE" }, { organizationId, userId: scannerId, role: "SCANNER", status: "ACTIVE" }, { organizationId, userId: billingId, role: "BILLING", status: "ACTIVE" }] });
      const design = await createBlankDesign(ownerId, "portrait", organizationId); expect(design).not.toBeNull(); if (!design) return; designId = design.id;
      const event = await createEvent(ownerId, { organizationId, designId, title: `4A6 Event ${suffix}`, eventType: "Wedding", eventDate: "2030-01-01" }); expect(event).not.toBeNull(); if (!event) return; eventId = event.id;
      expect(await canManageEvent(memberId, eventId)).toBe(true); expect(await canManageEvent(scannerId, eventId)).toBe(false); expect(await canManageEvent(billingId, eventId)).toBe(false); expect(await canManageEvent(otherId, eventId)).toBe(false);
      await db.organizationMember.update({ where: { organizationId_userId: { organizationId, userId: memberId } }, data: { status: "REMOVED" } }); expect(await canManageEvent(memberId, eventId)).toBe(false);
      expect(await createEvent(otherId, { organizationId, designId, title: "Cross tenant", eventType: "Other", eventDate: "2030-01-01" })).toBeNull(); expect(await createEvent(ownerId, { organizationId: otherOrganizationId, designId, title: "Wrong design org", eventType: "Other", eventDate: "2030-01-01" })).toBeNull();
      const personal = await createBlankDesign(ownerId, "square"); expect(personal).not.toBeNull(); if (!personal) return; personalDesignId = personal.id; expect(await getOwnedDesign(memberId, personalDesignId)).toBeNull(); expect(await getOwnedDesign(ownerId, personalDesignId)).not.toBeNull();
    } finally {
      if (eventId) await db.event.deleteMany({ where: { id: eventId } }); if (designId) await db.design.deleteMany({ where: { id: designId } }); if (personalDesignId) await db.design.deleteMany({ where: { id: personalDesignId } });
      for (const id of [organizationId, otherOrganizationId]) if (id) { await db.organizationMember.deleteMany({ where: { organizationId: id } }); await db.organization.deleteMany({ where: { id } }); }
      for (const id of [ownerId, memberId, scannerId, billingId, otherId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });
