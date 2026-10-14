import { site } from "@/config/site";
export function personalizedInvitationPath(slug:string, invitationCode:string){return `/i/${encodeURIComponent(slug)}/g/${encodeURIComponent(invitationCode)}`;}
export function personalizedInvitationUrl(slug:string, invitationCode:string){return `${site.url}${personalizedInvitationPath(slug,invitationCode)}`;}
