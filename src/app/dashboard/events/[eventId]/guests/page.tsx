import Link from "next/link";
import {notFound} from "next/navigation";
import {requireUser} from "@/lib/auth/guards";
import {getDb} from "@/lib/db";
import {listGuests} from "@/services/guests";
import {guestAction,allocateGuestEntryAction} from "./actions";
import {GuestImportForm} from "@/components/events/guest-import-form";
import {GuestInvitationActions} from "@/components/events/guest-invitation-actions";
import {personalizedInvitationUrl} from "@/services/invitation-links";
import {guestEntryLimit} from "@/lib/guest-entry-policy";
export default async function Guests({params,searchParams}:{params:Promise<{eventId:string}>;searchParams:Promise<{q?:string;error?:string;saved?:string}>}){
 const user=await requireUser(),{eventId}=await params,query=await searchParams,q=query.q||"";
 const guests=await listGuests(user.id,eventId,q);if(!guests)notFound();
 const event=await getDb().event.findUnique({where:{id:eventId},select:{title:true,slug:true,status:true}});if(!event)notFound();
 const inventory=await getDb().guestPass.findMany({where:{eventId,guestId:null,status:"ACTIVE",purchase:{status:{in:["ISSUED","BETA_ISSUED"]}}},select:{id:true,guestName:true,issuedAt:true},orderBy:{issuedAt:"asc"}});
 return <section className="mx-auto max-w-6xl px-6 py-12">
  <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-serif text-4xl">Guest Management</h1><Link href={`/dashboard/passes/${eventId}`} className="rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white">Manage Entry Passes</Link></div>
  <p className="mt-2">{event.title} · {guests.length} guests · RSVP capacity {guests.reduce((n,g)=>n+(g.plusOneAllowed?g.maxGuests:Math.min(1,g.maxGuests)),0)}</p>
  <p className="mt-2 text-sm">Invitation links identify guests for RSVP and private pass retrieval. RSVP does not create entry entitlement. Allocate already-issued passes below; each entry QR admits one person.</p>
  {(query.error||query.saved)&&<p role={query.error?"alert":"status"} className="mt-4 rounded-xl bg-ivory p-4 text-sm">{query.error||query.saved}</p>}
  <GuestImportForm eventId={eventId}/>
  <form className="mt-6"><input name="q" defaultValue={q} placeholder="Search guests"/><button className="ml-2 rounded-full border px-4 py-2">Search</button></form>
  <form action={guestAction} className="mt-6 grid gap-2 rounded-2xl bg-white p-5 sm:grid-cols-3"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="action" value="create"/><input name="name" required placeholder="Name"/><input name="phone" placeholder="Phone"/><input name="email" placeholder="Email"/><input name="category" placeholder="Category"/><input name="maxGuests" type="number" min="1" defaultValue="1"/><label><input name="plusOneAllowed" type="checkbox"/> Plus one</label><textarea name="notes" placeholder="Notes"/><button className="rounded-full bg-forest px-4 py-2 text-white">Add Guest</button></form>
  <div className="mt-6 space-y-4">{guests.map(guest=>{
   const limit=guestEntryLimit(guest);
   return <article key={guest.id} aria-label={`${guest.name} guest`} className="rounded-2xl bg-white p-4">
    <h2 className="font-semibold">{guest.name}</h2>
    <form action={guestAction} className="mt-3 grid gap-2 sm:grid-cols-3"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="guestId" value={guest.id}/><input type="hidden" name="action" value="update"/>
     <label>Name<input name="name" defaultValue={guest.name}/></label><label>Phone<input name="phone" defaultValue={guest.phone||""}/></label><label>Email<input name="email" defaultValue={guest.email||""}/></label><label>Category<input name="category" defaultValue={guest.category||""}/></label><label>RSVP party limit<input name="maxGuests" type="number" min="1" defaultValue={guest.maxGuests}/></label><label><input name="plusOneAllowed" type="checkbox" defaultChecked={guest.plusOneAllowed}/> Plus one allowed</label><textarea name="notes" defaultValue={guest.notes||""} aria-label="Guest notes"/><button name="action" value="delete" className="text-red-700" disabled={!!guest.entryPasses.length}>Delete guest</button><button className="underline">Save guest</button>
    </form>
    <div className="mt-4">{event.status==="PUBLISHED"?<GuestInvitationActions url={personalizedInvitationUrl(event.slug,guest.invitationCode)} name={guest.name}/>:<p className="text-sm">Publish the event to enable the invitation.</p>}</div>
    <p className="mt-4 text-sm">RSVP: {guest.rsvps[0]?.status||"Not received"} · Eligible party size: {limit}</p>
    <p className="mt-1 text-sm">Entry-pass status: {guest.entryPasses.length?guest.entryPasses.map(p=>`Pass ${p.guestSlot}: ${p.status}`).join(" · "):"Not allocated"}</p>
    {guest.entryPasses.length>0 && <Link className="mt-3 inline-block rounded-full border px-4 py-2 text-sm" href={`/dashboard/events/${eventId}/guests/${guest.id}/entry-pass`}>View Entry Pass</Link>}
    {limit>0&&event.status==="PUBLISHED"?<form action={allocateGuestEntryAction} className="mt-4 grid gap-3 rounded-xl bg-ivory p-4">
     <input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="guestId" value={guest.id}/>
     <label>Total entry passes for this guest<input name="quantity" type="number" min="1" max={limit} defaultValue={Math.max(1,Math.min(limit,guest.entryPasses.length||1))} required/></label>
     <label>Issued inventory<select name="sourcePassId" defaultValue="" className="mt-1 w-full rounded-xl border bg-white p-3"><option value="">Automatically use unused, unassigned passes</option>{inventory.map((pass,index)=><option value={pass.id} key={pass.id}>Issued pass {index+1}{pass.guestName?` · Legacy name: ${pass.guestName}`:" · Unassigned"} · {pass.issuedAt.toLocaleDateString("en-TZ")}</option>)}</select></label>
     <p className="text-xs">Explicitly select a legacy pass if it was previously assigned by name only. A selected legacy pass links one new slot at a time. Existing allocated slots are never regenerated.</p>
     <label className="text-sm"><input type="checkbox" name="confirmLink" value="yes" required/> I understand that linking a pass invalidates its previous QR. The guest will use My Entry Pass from their personal invitation.</label>
     <button className="rounded-full bg-forest px-4 py-3 text-white">Allocate Entry Pass</button>
     {!inventory.length&&<p className="text-sm">No unlinked issued passes remain. Open Manage Entry Passes to issue available purchased/beta capacity.</p>}
    </form>:<p className="mt-3 text-sm text-forest/70">Publish the event and ask the guest to RSVP attending before allocating an entry pass.</p>}
   </article>;
  })}</div>
 </section>;
}
