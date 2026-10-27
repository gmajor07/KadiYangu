"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {QrCameraSession,cameraErrorMessage,type CameraPhase} from "@/lib/scanner/camera";
import {parseEntryQr,ScanGate,scanFeedback,type ScanResult} from "@/lib/scanner/contracts";

export function GateScanner({event}:{event:{id:string;title:string}}){
  const video=useRef<HTMLVideoElement>(null);
  const session=useRef<QrCameraSession|null>(null);
  const mounted=useRef(true);
  const request=useRef<AbortController|null>(null);
  const gate=useRef(new ScanGate());
  const waitingForNext=useRef(false);
  const [phase,setPhase]=useState<CameraPhase>("idle");
  const [cameraError,setCameraError]=useState("");
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  const [deviceId,setDeviceId]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<ScanResult|null>(null);
  const [manual,setManual]=useState("");

  const verify=useCallback(async(value:string)=>{
    if(waitingForNext.current || !gate.current.claim(value))return;
    const parsed=parseEntryQr(value);
    if(!parsed.ok){setResult({ok:false,reason:parsed.reason});waitingForNext.current=true;gate.current.release();return;}
    setBusy(true);setResult(null);
    const controller=new AbortController();request.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(`/api/events/${encodeURIComponent(event.id)}/check-in`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:parsed.token}),signal:controller.signal,cache:"no-store",credentials:"same-origin",redirect:"error"});
      const data=await response.json();
      // An HTTP error/redirect can never be presented as an approval.
      const next:ScanResult=response.ok && data.ok===true && data.entry?.allowedEntries===1 && data.entry?.checkedIn===1 && data.entry?.remaining===0 ? {ok:true,entry:data.entry} : {ok:false,reason:typeof data.reason==="string"?data.reason:"UNAVAILABLE",entry:data.ok===false?data.entry:undefined};
      if(mounted.current){setResult(next);waitingForNext.current=true;}
    }catch{
      if(mounted.current){setResult({ok:false,reason:"UNAVAILABLE"});waitingForNext.current=true;}
    }finally{
      window.clearTimeout(timeout);gate.current.release();
      if(request.current===controller)request.current=null;
      if(mounted.current){setBusy(false);setManual("");}
    }
  },[event.id]);

  const stopCamera=useCallback(()=>{session.current?.stop();session.current=null;setPhase("idle");},[]);
  async function startCamera(){
    if(!video.current || phase==="starting")return;
    session.current?.stop();
    if(!window.isSecureContext){setCameraError("Camera requires HTTPS or localhost. Open the secure scanner URL directly.");setPhase("error");return;}
    if(!navigator.mediaDevices?.getUserMedia){setCameraError("This browser does not support camera access. Try a current Safari, Chrome, Firefox or Edge browser, or use manual entry.");setPhase("error");return;}
    setPhase("starting");setCameraError("");
    const current=new QrCameraSession(value=>{void verify(value);},error=>{if(mounted.current && session.current===current){setCameraError(cameraErrorMessage(error));setPhase("error");}});
    session.current=current;
    try{
      const started=await current.start(video.current,deviceId || undefined);
      if(!mounted.current || session.current!==current || !started)return;
      setPhase("running");
      // Enumerating AFTER permission exposes labels; selecting a camera is optional.
      try{const list=await navigator.mediaDevices.enumerateDevices();if(mounted.current && session.current===current)setDevices(list.filter(d=>d.kind==="videoinput"));}catch{/* Capture remains usable if device enumeration is restricted. */}
    }catch(error){if(mounted.current && session.current===current){setCameraError(cameraErrorMessage(error));setPhase("error");}}
  }
  useEffect(()=>{
    mounted.current=true;
    const hidden=()=>{if(document.visibilityState==="hidden"){session.current?.stop();session.current=null;if(mounted.current)setPhase("idle");}};
    document.addEventListener("visibilitychange",hidden);
    return()=>{mounted.current=false;document.removeEventListener("visibilitychange",hidden);session.current?.stop();session.current=null;request.current?.abort();};
  },[]);
  const feedback=result?scanFeedback(result):null;
  function nextGuest(){waitingForNext.current=false;setResult(null);setManual("");}

  return <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Gate scanner</p><h1 className="mt-2 font-serif text-3xl">{event.title}</h1><p className="mt-2 text-sm text-forest/70">Scan the guest&apos;s entry-pass QR. Each pass admits one person.</p></div><Link href="/dashboard/scanner" className="shrink-0 text-sm underline">Change event</Link></div>
    <div className="relative mt-5 overflow-hidden rounded-3xl bg-black">
      {/* Always mounted: the stream needs a real video element before starting. */}
      <video ref={video} aria-label="Live camera preview" className="aspect-[4/5] w-full object-cover sm:aspect-square" muted playsInline autoPlay/>
      {phase==="running" ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><div className="h-60 w-60 max-w-[75%] rounded-2xl border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]"/></div> : <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60 px-8 text-center text-sm text-white"><p>{phase==="starting"?"Starting camera… Allow camera access when your browser asks.":phase==="error"?"Camera unavailable. See the guidance below.":"Camera stopped. Tap Start camera to show a live preview."}</p></div>}
      {phase==="running" && <p className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white">{busy?"Verifying with server…":result?"Result ready — scan next guest to continue":"Hold the entry QR inside the guide"}</p>}
    </div>
    <div className="mt-3 flex flex-wrap gap-3">
      {phase!=="running" && phase!=="starting" && <button type="button" onClick={startCamera} className="rounded-xl bg-forest px-5 py-3 font-semibold text-white">{phase==="error"?"Retry camera":"Start camera"}</button>}
      {(phase==="running" || phase==="starting") && <button type="button" onClick={stopCamera} className="rounded-xl border border-forest/30 bg-white px-5 py-3">Stop camera</button>}
    </div>
    {devices.length>1 && <label className="mt-4 block text-sm">Camera<select value={deviceId} onChange={e=>{stopCamera();setDeviceId(e.target.value);}} className="mt-1 w-full rounded-xl border bg-white p-3"><option value="">Automatic (prefer rear camera)</option>{devices.map((device,i)=><option key={device.deviceId || i} value={device.deviceId}>{device.label || `Camera ${i+1}`}</option>)}</select><span className="mt-1 block text-xs opacity-70">After changing camera, tap Start camera.</span></label>}
    {cameraError && <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{cameraError}</p>}
    {busy && <p role="status" className="mt-4 rounded-xl bg-white p-4">Verifying entry online…</p>}
    {result && feedback && <section role="status" aria-live="polite" aria-atomic="true" className={`mt-4 rounded-2xl border-2 p-5 ${feedback.tone==="success"?"border-green-600 bg-green-50":"border-amber-500 bg-amber-50"}`}><h2 className="text-xl font-semibold">{feedback.title}</h2><p className="mt-2 text-sm">{feedback.message}</p>{result.entry && <div className="mt-3 text-sm"><p className="font-semibold">{result.entry.guestName || "Unassigned guest pass"}</p><p>Allowed: {result.entry.allowedEntries} · Checked in: {result.entry.checkedIn} · Remaining: {result.entry.remaining}</p></div>}<button type="button" onClick={nextGuest} className="mt-4 rounded-xl bg-forest px-4 py-3 font-semibold text-white">Scan next guest</button></section>}
    <p className="mt-4 text-xs leading-5 text-forest/65">Only server-confirmed entry passes are approved. Invitation QR codes are for viewing invitations and RSVP, not entry. For groups or plus-ones, scan a separate issued pass for each person.</p>
    <details className="mt-5 rounded-2xl border border-forest/15 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Optional manual fallback</summary><p className="mt-3 text-sm text-forest/70">Use only when camera scanning is unavailable. Paste an entry-pass code from the organizer; invitation links will not work.</p><form onSubmit={e=>{e.preventDefault();void verify(manual);}} className="mt-3 grid gap-3"><label htmlFor="entry-code">Entry-pass code<input id="entry-code" type="password" value={manual} onChange={e=>setManual(e.target.value)} required autoComplete="off" spellCheck={false} maxLength={100} className="mt-1"/></label><button disabled={busy || !!result} className="rounded-xl border px-4 py-3 disabled:opacity-50">{busy?"Verifying…":"Verify entry-pass code"}</button></form></details>
  </main>;
}
