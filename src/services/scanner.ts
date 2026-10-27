import "server-only";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";

// Same authorization contract as entry-pass check-in: owner or assigned event staff.
// Organization membership alone does not grant attendance-write permission.
export function scannerEventAccess(userId: string): Prisma.EventWhereInput {
  return { OR: [{userId}, {staff:{some:{userId}}}] };
}
export async function resolveScannerEvent(userId: string, requested: string | string[] | undefined) {
  const db = getDb();
  if (requested !== undefined) {
    if (typeof requested !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(requested)) return {kind:"denied" as const};
    const event = await db.event.findFirst({where:{AND:[{id:requested},scannerEventAccess(userId)]},select:{id:true,title:true}});
    return event ? {kind:"selected" as const,event} : {kind:"denied" as const};
  }
  const events = await db.event.findMany({where:scannerEventAccess(userId),select:{id:true,title:true,eventDate:true},orderBy:{eventDate:"desc"}});
  return {kind:"picker" as const,events};
}
