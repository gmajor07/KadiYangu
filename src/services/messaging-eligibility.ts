import "server-only";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
type Consent = {guestId: string | null; contributorId: string | null; status: string};
type Guest = {id: string; phone: string | null; email: string | null};
type Contributor = Guest & {guestId: string | null};
export function messagingPhone(value: string | null) {
  const digits = (value || "").replace(/[\s()+-]/g, "");
  const phone = /^0[67]\d{8}$/.test(digits) ? `255${digits.slice(1)}` : digits;
  return /^255[67]\d{8}$/.test(phone) ? phone : "";
}
// Restrictive aggregation prevents older/duplicate nullable consent rows granting access.
export function identityConsent(consents: Consent[], guestId?: string, contributorId?: string) {
  const rows = consents.filter(c => contributorId ? c.contributorId === contributorId : c.guestId === guestId && !c.contributorId);
  if (rows.some(c=>c.status === "OPTED_OUT")) return "OPTED_OUT";
  if (!rows.length || rows.some(c=>c.status !== "OPTED_IN")) return "UNKNOWN";
  return "OPTED_IN";
}
export function computeMessagingEligibility(guests: Guest[], contributors: Contributor[], consents: Consent[], channel: "SMS" | "WHATSAPP" | "EMAIL") {
  const seen = new Set<string>();
  const eligible: {guestId?: string; contributorId?: string; destination: string}[] = [];
  const excluded: {reason: string}[] = [];
  const add = (person: Guest, contributor?: Contributor) => {
    const guestId = contributor ? contributor.guestId || undefined : person.id;
    const linkedContributors = guestId ? contributors.filter(c=>c.guestId === guestId) : contributor ? [contributor] : [];
    const statuses = [ ...(guestId ? [identityConsent(consents,guestId)] : []), ...linkedContributors.map(c=>identityConsent(consents,undefined,c.id)) ];
    const destination = channel === "EMAIL" ? person.email?.trim().toLowerCase() || "" : messagingPhone(person.phone);
    const reason = !destination ? "missing_contact" : statuses.includes("OPTED_OUT") ? "opted_out" : !statuses.length || statuses.includes("UNKNOWN") ? "unknown_consent" : seen.has(destination) ? "duplicate" : null;
    if (reason) { excluded.push({reason}); return; }
    seen.add(destination);
    eligible.push({guestId,contributorId:contributor?.id,destination});
  };
  [...guests].sort((a,b)=>a.id.localeCompare(b.id)).forEach(g=>add(g));
  [...contributors].sort((a,b)=>a.id.localeCompare(b.id)).forEach(c=>add(c,c));
  return {eligible,excluded};
}
export async function loadMessagingEligibility(eventId: string, channel: "SMS" | "WHATSAPP" | "EMAIL", db: Pick<Prisma.TransactionClient,"guest"|"eventContributor"|"messageConsent"> = getDb()) {
  const [guests,contributors,consents] = await Promise.all([
    db.guest.findMany({where:{eventId},select:{id:true,phone:true,email:true}}),
    db.eventContributor.findMany({where:{eventId},select:{id:true,guestId:true,phone:true,email:true}}),
    db.messageConsent.findMany({where:{eventId,channel},select:{guestId:true,contributorId:true,status:true}}),
  ]);
  return computeMessagingEligibility(guests,contributors,consents,channel);
}
export const recipientIdentity = (r: {guestId?: string | null; contributorId?: string | null; destination: string}) => `${r.guestId || ""}:${r.contributorId || ""}:${r.destination}`;
