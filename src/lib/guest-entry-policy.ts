export type GuestEntryPolicy={maxGuests:number;plusOneAllowed:boolean;rsvps:Array<{status:string;guestCount:number}>};
export function guestEntryLimit(guest:GuestEntryPolicy){
 const latest=guest.rsvps[0];
 if(!latest || latest.status!=="ATTENDING")return 0;
 const limit=guest.plusOneAllowed?guest.maxGuests:Math.min(1,guest.maxGuests);
 return Number.isInteger(latest.guestCount)&&latest.guestCount>=1?Math.min(limit,latest.guestCount):0;
}
export function boundEntryAllowed(guest:GuestEntryPolicy|null,eventPublished:boolean,slot:number|null){
 return !!guest && eventPublished && Number.isInteger(slot) && slot!>=1 && slot!<=guestEntryLimit(guest);
}
