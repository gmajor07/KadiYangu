import {notFound} from "next/navigation";
import {getPersonalizedEvent} from "@/services/events";
import {personalizedEntryPasses} from "@/services/guest-entry-passes";
import {PublicWebsite} from "@/components/events/public-website";
import {EntryPassPanel} from "@/components/events/entry-pass-panel";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Personalized({params,searchParams}:{params:Promise<{slug:string;invitationCode:string}>;searchParams?:Promise<{rsvp?:string;name?:string;status?:string;guests?:string}>}){
 const {slug,invitationCode}=await params;const event=await getPersonalizedEvent(slug,invitationCode);
 if(!event||!event.guests[0])notFound();
 const guest=event.guests[0],q=searchParams?await searchParams:{},view=await personalizedEntryPasses(slug,invitationCode);
 if(!view)notFound();
 return <PublicWebsite event={event} rsvpError={q.rsvp==="blocked"?"RSVP could not be saved. Check your party limit; entries already used cannot be withdrawn.":undefined} confirmation={q.rsvp==="success"?{name:guest.name,status:guest.rsvps[0]?.status}:undefined} personalizedGuest={{name:guest.name,maxGuests:guest.plusOneAllowed?guest.maxGuests:Math.min(1,guest.maxGuests),existingStatus:guest.rsvps[0]?.status,existingGuestCount:guest.rsvps[0]?.guestCount,invitationCode}} entryPass={<EntryPassPanel view={view} qrUrl={`/api/invitations/${encodeURIComponent(slug)}/${encodeURIComponent(invitationCode)}/entry-pass`}/>}/>;
}
