import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { listMessageTemplates, recipientDirectory, previewCampaignRecipients, eligibleRecipients } from "@/services/messaging";
import { messageActionState } from "./actions";
import { MessagingActionForm } from "@/components/messaging/action-form";
import { PreviewPanel } from "@/components/messaging/preview-panel";
import { smsConfiguration } from "@/services/beem-sms";
import { smsQueueOverview } from "@/services/sms-queue";
import { recipientIdentity } from "@/services/messaging-eligibility";
import { RecipientSelector } from "@/components/messaging/recipient-selector";

export default async function Messages({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ q?: string; page?: string; channel?: string; selected?: string; preview?: string; previewPage?: string; campaignId?: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const query = await searchParams;
  const q = query?.q || "";
  const page = Number(query?.page || 1);
  const channel = (["SMS","WHATSAPP","EMAIL"].includes(query?.channel || "") ? query?.channel : "SMS") as "SMS" | "WHATSAPP" | "EMAIL";
  const selectedIds = (query?.selected || "").split(",").filter(Boolean);
  const event = await getDb().event.findUnique({ where: { id: eventId }, select: { title: true } });
  const templates = await listMessageTemplates(user.id, eventId);
  if (!event || !templates) notFound();
  const campaigns = await getDb().messageCampaign.findMany({ where: { eventId }, include: { template: true, recipients: {select:{id:true,destination:true,renderedBody:true,status:true,guestId:true,contributorId:true}} }, orderBy: { createdAt: "desc" } });
  const directory = await recipientDirectory(user.id, eventId, channel, q, page, 20);
  const previewCampaign = query?.campaignId ? campaigns.find(c => c.id === query.campaignId) : campaigns.find(c => c.status === "DRAFT");
  const preview = previewCampaign && query?.preview ? await previewCampaignRecipients(user.id, eventId, previewCampaign.id, selectedIds, Number(query?.previewPage || 1), 10) : null;
  const action = messageActionState;
  const config = smsConfiguration();
  const queue = await smsQueueOverview(user.id,eventId);
  const smsEligible = new Set((await eligibleRecipients(user.id,eventId,"SMS"))?.eligible.map(recipientIdentity));
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm underline">← {event.title}</Link>
      <h1 className="mt-4 font-serif text-4xl">Messages</h1>
      <p className="mt-2 text-sm opacity-70">Phase 7E.4 — PREPARED. SMS dispatch disabled until explicit activation. Mock jobs never contact Beem.</p>

      <section className="mt-8 rounded-2xl bg-white p-5">
        <h2 className="font-serif text-2xl">Create template</h2>
        <MessagingActionForm action={action} label="Save template">
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="action" value="template" />
          <input name="name" required placeholder="Template name" /><select name="channel"><option>SMS</option><option>WHATSAPP</option><option>EMAIL</option></select>
          <textarea name="body" required placeholder="Hello {guest_name}, you are invited to {event_name}." />
        </MessagingActionForm>
      </section>

      <section className="mt-8"><h2 className="font-serif text-2xl">Templates</h2>{templates.map(t => <div className="mt-3 rounded-xl bg-white p-4" key={t.id}><b>{t.name}</b><span className="ml-2 text-xs">{t.channel}</span><p className="mt-2 text-sm">{t.body}</p></div>)}</section>

      <section className="mt-8 rounded-2xl bg-white p-5">
        <h2 className="font-serif text-2xl">Create campaign draft</h2>
        <MessagingActionForm action={action} label="Save campaign draft">
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="action" value="campaign" />
          <input name="name" required placeholder="Campaign name" /><select name="channel"><option>SMS</option><option>WHATSAPP</option><option>EMAIL</option></select>
          <select name="templateId" required><option value="">Choose template</option>{templates.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select>
        </MessagingActionForm>
      </section>

      <section aria-label="SMS preparation status" className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-serif text-2xl">SMS dispatch disabled · PREPARED</h2>
        <p className="mt-2 text-sm">Credentials: {config.credentialsPresent ? "configured" : "missing or invalid"} · Sender ID: {config.senderPresent ? (config.senderApproved ? "approval recorded" : "approval pending") : "missing or invalid"}</p>
        <p className="text-sm">Live provider: locked · Mock execution: {config.mockEnabled ? "enabled explicitly" : "disabled"} · Eligible SMS recipients: {smsEligible.size}</p>
        {queue?.migrationRequired && <p role="status" className="mt-2 text-sm">Queue migration requires review and application before queue preparation is available. No migration has been applied by this phase.</p>}
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl">Campaigns</h2>
        {campaigns.map(c => {
          const jobs = queue?.jobs.filter(j=>j.campaignId===c.id) || [];
          const eligibleCount = c.recipients.filter(r=>smsEligible.has(recipientIdentity(r))).length;
          return <div className="mt-3 rounded-xl bg-white p-4" key={c.id}>
            <p>{c.name} · {c.channel} · {c.status} · {c.recipients.length} recipients</p>
            {c.channel === "SMS" && <>
              <p className="mt-2 text-sm">Queue readiness: {c.status === "READY" && eligibleCount > 0 ? "ready for mock preparation" : "blocked: requires READY campaign and eligible saved recipients"} · Eligible saved: {eligibleCount}</p>
              <p className="text-sm">Pending: {jobs.filter(j=>j.smsJobState==="PENDING").length} · Processing: {jobs.filter(j=>j.smsJobState==="PROCESSING").length} · Retry waiting: {jobs.filter(j=>j.smsJobState==="RETRY_WAIT").length} · Mock complete: {jobs.filter(j=>j.smsJobState==="COMPLETE").length} · Failed: {jobs.filter(j=>j.smsJobState==="FAILED").length} · Uncertain: {jobs.filter(j=>j.smsJobState==="UNCERTAIN").length}</p>
              {c.status === "READY" && !queue?.migrationRequired && <MessagingActionForm action={action} label="Prepare mock queue"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="action" value="queue"/><input type="hidden" name="campaignId" value={c.id}/><p className="text-xs">Creates mock jobs only. Does not send SMS.</p></MessagingActionForm>}
              {jobs.filter(j=>j.smsJobState!=="NONE").map(job=><div key={job.id} className="mt-2 rounded border p-2 text-xs"><p>Mode: {job.smsMode} · Queue: {job.smsJobState} · Delivery: {job.smsMode === "MOCK" ? "simulated only; no SMS sent" : job.status} · Attempts: {job.smsAttempts}/3</p>{job.smsFailureReason && <p>Failure: {job.smsFailureReason}</p>}<p>Retry: {job.smsJobState === "RETRY_WAIT" && job.smsNextAttemptAt ? `eligible after ${job.smsNextAttemptAt.toISOString()}` : "not eligible"}</p></div>)}
            </>}
            {c.recipients.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-sm underline">Preview saved messages</summary>{c.recipients.slice(0,10).map(r=><div className="mt-2 rounded border p-2 text-sm" key={r.id}><span>{r.destination} · {r.status}</span><p>{r.renderedBody}</p></div>)}</details>}
            {c.status === "DRAFT" && <>
              {channel === c.channel ? <MessagingActionForm action={action} label="Save recipients"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="action" value="recipients"/><input type="hidden" name="campaignId" value={c.id}/><input type="hidden" name="eventName" value={event.title}/><RecipientSelector rows={directory?.rows || []} eligibleCount={directory?.eligibleCount || 0} excludedCount={directory?.excludedCount || 0} initialSelected={selectedIds} templateBody={c.template?.body} eventId={eventId} channel={c.channel}/></MessagingActionForm> : <Link className="text-sm underline" href={`?channel=${c.channel}`}>Choose {c.channel} recipients</Link>}
              <MessagingActionForm action={action} label="Mark ready"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="action" value="transition"/><input type="hidden" name="campaignId" value={c.id}/><input type="hidden" name="status" value="READY"/></MessagingActionForm>
            </>}
            {c.status !== "CANCELLED" && <MessagingActionForm action={action} label="Cancel campaign"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="action" value="transition"/><input type="hidden" name="campaignId" value={c.id}/><input type="hidden" name="status" value="CANCELLED"/></MessagingActionForm>}
          </div>;
        })}
      </section>

      <section className="mt-8 rounded-2xl bg-white p-5"><h2 className="font-serif text-2xl">Recipients</h2><form method="get" className="mt-3 flex flex-wrap gap-2"><select name="channel" defaultValue={channel}><option>SMS</option><option>WHATSAPP</option><option>EMAIL</option></select><input name="q" defaultValue={q} placeholder="Search name or contact" className="rounded border px-3 py-2" /><button className="rounded-full bg-rose-gold px-4 py-2 text-white">Search</button></form><p className="mt-2 text-sm opacity-70">Eligible: {directory?.eligibleCount || 0} · Excluded: {directory?.excludedCount || 0} · Page {directory?.page || 1} of {directory?.pages || 1}</p>{directory?.rows.map(r => <div className="mt-2 border-b py-2" key={`${r.kind}-${r.id}`}>{r.name} <span className="text-sm opacity-70">({r.kind}) · {r.contact || "Missing contact"} · {r.consent}</span><MessagingActionForm action={action} label="Update consent"><input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="action" value="consent"/><input type="hidden" name={r.kind === "GUEST" ? "guestId" : "contributorId"} value={r.id}/><input type="hidden" name="channel" value={channel}/><select name="status" defaultValue={r.consent}><option value="UNKNOWN">Unknown consent</option><option value="OPTED_IN">Confirmed opt-in</option><option value="OPTED_OUT">Opted out</option></select></MessagingActionForm></div>)}<div className="mt-3 flex gap-3">{page > 1 && <Link href={`?q=${encodeURIComponent(q)}&channel=${channel}&selected=${encodeURIComponent(selectedIds.join(","))}&page=${page - 1}`}>Previous</Link>}{directory && page < directory.pages && <Link href={`?q=${encodeURIComponent(q)}&channel=${channel}&selected=${encodeURIComponent(selectedIds.join(","))}&page=${page + 1}`}>Next</Link>}</div></section>

      {preview && <PreviewPanel preview={preview} eventId={eventId} channel={channel} audience="GUESTS" selected={selectedIds} />}
    </main>
  );
}
