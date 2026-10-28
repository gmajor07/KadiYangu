import Link from "next/link";
import {notFound} from "next/navigation";
import {requireUser} from "@/lib/auth/guards";
import {organizerEntryPasses} from "@/services/guest-entry-passes";
import {EntryPassPanel} from "@/components/events/entry-pass-panel";
export const dynamic="force-dynamic";
export default async function GuestEntryPass({params}:{params:Promise<{eventId:string;guestId:string}>}){
 const user=await requireUser();const {eventId,guestId}=await params;
 const view=await organizerEntryPasses(user.id,eventId,guestId);if(!view)notFound();
 return <main className="mx-auto max-w-xl px-4 py-8"><Link href={`/dashboard/events/${eventId}/guests`} className="mb-5 inline-block underline">← Guest Management</Link><EntryPassPanel view={view} qrUrl={`/api/events/${eventId}/guests/${guestId}/entry-pass`}/></main>;
}
