/* eslint-disable @next/next/no-img-element -- private blob QR images must never use shared image optimization caches */
"use client";
import {useEffect,useRef,useState} from "react";
import type {EntryPassView} from "@/services/guest-entry-passes";
export function EntryPassPanel({view,qrUrl}:{view:EntryPassView;qrUrl:string}){
 const [image,setImage]=useState<{url:string;slot:number}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const current=useRef<string|null>(null);
 const mounted=useRef(true),request=useRef<AbortController|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();if(current.current)URL.revokeObjectURL(current.current);};},[]);
 async function load(slot:number,save=false){
  if(busy)return;setBusy(true);setError("");
  const controller=new AbortController();request.current=controller;
  try{
   const response=await fetch(`${qrUrl}?slot=${slot}`,{cache:"no-store",credentials:"same-origin",redirect:"error",signal:controller.signal});
   if(!response.ok || !response.headers.get("content-type")?.startsWith("image/png"))throw new Error("Pass is unavailable. Refresh this invitation to check its current status, or contact the organizer.");
   const blob=await response.blob();if(!mounted.current)return;
   const url=URL.createObjectURL(blob);
   if(save){const link=document.createElement("a");link.href=url;link.download=`${view.eventName.replace(/[^a-zA-Z0-9_-]/g,"-")}-entry-${slot}.png`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),10000);}
   else {if(current.current)URL.revokeObjectURL(current.current);current.current=url;setImage({url,slot});}
  }catch(error){if(mounted.current){if(current.current)URL.revokeObjectURL(current.current);current.current=null;setImage(null);setError(error instanceof Error?error.message:"Pass unavailable.");}}
  finally{if(mounted.current)setBusy(false);}
 }
 return <section id="my-entry-pass" className="scroll-mt-4 rounded-3xl bg-white p-6 shadow-sm" aria-labelledby="entry-pass-heading">
  <h2 id="entry-pass-heading" className="font-serif text-2xl">My Entry Pass</h2>
  <p className="mt-2 font-semibold">{view.guestName} · {view.eventName}</p>
  <p className="mt-2 text-sm">Keep your personal invitation link private. Reopen it to access the same allocated passes. Each QR admits one person.</p>
  {view.reason && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">{view.reason}</p>}
  {!view.reason && <p className="mt-3 text-sm">Allocated passes: {view.passes.length}. Current RSVP limit: {view.limit}. Extra guests each need their own allocated QR.</p>}
  {view.passes.map(pass=><div className="mt-4 rounded-xl border p-4" key={pass.slot}>
   <p className="font-semibold">Entry pass {pass.slot} · {pass.status.replaceAll("_"," ")}</p>
   <p className="text-sm">Allowed entry count: 1</p>
   {pass.available ? <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={()=>load(pass.slot)} className="rounded-full bg-forest px-5 py-3 text-white">Show Pass {view.passes.length>1?pass.slot:""}</button><button type="button" disabled={busy} onClick={()=>load(pass.slot,true)} className="rounded-full border px-5 py-3">Save QR {view.passes.length>1?pass.slot:""}</button></div> : <p className="mt-2 text-sm text-forest/70">{pass.status==="CHECKED_IN"?"Already checked in. This pass cannot admit another person.":pass.status==="REVOKED"?"This pass was revoked. Contact the organizer.":pass.reason || view.reason || (pass.slot>view.limit?"This pass is outside your current RSVP limit.":"Secure QR retrieval is unavailable. Ask the organizer to replace this pass.")}</p>}
  </div>)}
  <button type="button" onClick={()=>window.location.reload()} className="mt-4 text-sm underline">Refresh pass status</button>
  {busy && <p role="status" className="mt-3">Loading secure entry QR…</p>}
  {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  {image && <div role="dialog" aria-modal="true" aria-label="Your entry pass" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"><div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center"><h3 className="font-serif text-2xl">{view.eventName}</h3><p className="mt-1">{view.guestName}</p><p className="text-sm">Entry pass {image.slot} · Admits 1 person</p><img src={image.url} alt="Guest entry-pass QR" className="mx-auto my-4 aspect-square w-full max-w-72"/><button type="button" disabled={busy} onClick={()=>load(image.slot,true)} className="mr-3 rounded-full bg-forest px-5 py-3 text-white">Save this QR</button><button type="button" autoFocus onClick={()=>{if(current.current)URL.revokeObjectURL(current.current);current.current=null;setImage(null);}} className="rounded-full border px-5 py-3">Close pass</button></div></div>}
 </section>;
}
