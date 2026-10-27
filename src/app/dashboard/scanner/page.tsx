import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { resolveScannerEvent } from "@/services/scanner";
import { GateScanner } from "@/components/scanner/gate-scanner";
export const dynamic = "force-dynamic";
export default async function Scanner({searchParams}:{searchParams:Promise<{event?:string|string[]}>}) {
  const query = await searchParams;
  const user = await requireUser("/dashboard/scanner");
  const context = await resolveScannerEvent(user.id,query.event);
  if (context.kind === "denied") return <main className="mx-auto max-w-lg px-4 py-10"><h1 className="font-serif text-3xl">Event unavailable</h1><p role="alert" className="mt-4">The event could not be found or you do not have check-in permission.</p><Link href="/dashboard/scanner" className="mt-6 inline-block underline">Choose an authorized event</Link></main>;
  if (context.kind === "selected") return <GateScanner key={context.event.id} event={context.event}/>;
  return <main className="mx-auto max-w-lg px-4 py-10"><p className="eyebrow">Gate scanner</p><h1 className="mt-3 font-serif text-3xl">Choose an event</h1><p className="mt-3 text-sm">Only events you can check in guests for appear here.</p>{context.events.length ? <form method="get" className="mt-6 grid gap-4"><label htmlFor="scanner-event">Event</label><select id="scanner-event" name="event" required className="rounded-xl border bg-white p-3"><option value="">Select an event</option>{context.events.map(event=><option key={event.id} value={event.id}>{event.title} · {event.eventDate.toLocaleDateString("en-TZ")}</option>)}</select><button className="rounded-xl bg-forest p-3 font-semibold text-white">Open scanner</button></form> : <p className="mt-6 rounded-xl bg-white p-4">No events available. Ask the event organizer to assign you as event staff.</p>}</main>;
}
