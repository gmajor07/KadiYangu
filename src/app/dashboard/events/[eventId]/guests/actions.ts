"use server";import {redirect} from "next/navigation";import {requireUser} from "@/lib/auth/guards";import {createGuest,updateGuest,deleteGuest} from "@/services/guests";export async function guestAction(f:FormData){const u=await requireUser();const eventId=String(f.get("eventId"));const data=Object.fromEntries(f.entries());const action=String(f.getAll("action").at(-1));if(action==="create")await createGuest(u.id,eventId,data);if(action==="update")await updateGuest(u.id,eventId,String(f.get("guestId")),data);if(action==="delete"&&!await deleteGuest(u.id,eventId,String(f.get("guestId"))))redirect(`/dashboard/events/${eventId}/guests?error=${encodeURIComponent("Guests with allocated passes cannot be deleted. Keep their pass and check-in history.")}`);redirect(`/dashboard/events/${eventId}/guests`)}

export async function allocateGuestEntryAction(form:FormData){
 const user=await requireUser();const eventId=String(form.get("eventId")||"");
 const {allocateGuestEntryPasses}=await import("@/services/guest-entry-passes");
 const result=form.get("confirmLink")==="yes"?await allocateGuestEntryPasses(user.id,eventId,String(form.get("guestId")||""),Number(form.get("quantity")),String(form.get("sourcePassId")||"")||undefined):{ok:false,error:"Confirm that linking invalidates the previous QR first."};
 const {revalidatePath}=await import("next/cache");if(result.ok)revalidatePath(`/dashboard/events/${eventId}/guests`);
 redirect(`/dashboard/events/${encodeURIComponent(eventId)}/guests?${result.ok?"saved":"error"}=${encodeURIComponent(("success" in result?result.success:result.error)||"Unable to allocate passes")}`);
}
