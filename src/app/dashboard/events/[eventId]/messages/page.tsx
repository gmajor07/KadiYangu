import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { listMessageTemplates, recipientDirectory, previewCampaignRecipients } from "@/services/messaging";
import { messageActionState } from "./actions";
import { MessagingActionForm } from "@/components/messaging/action-form";
import { PreviewPanel } from "@/components/messaging/preview-panel";
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
  const channel = (query?.channel || "SMS") as "SMS" | "WHATSAPP" | "EMAIL";
  const selectedIds = (query?.selected || "").split(",").filter(Boolean);
  const event = await getDb().event.findUnique({ where: { id: eventId }, select: { title: true } });
  const templates = await listMessageTemplates(user.id, eventId);
  if (!event || !templates) notFound();
  const campaigns = await getDb().messageCampaign.findMany({ where: { eventId }, include: { template: true, recipients: true }, orderBy: { createdAt: "desc" } });
  const directory = await recipientDirectory(user.id, eventId, channel, q, page, 20);
  const previewCampaign = query?.campaignId ? campaigns.find(c => c.id === query.campaignId) : campaigns.find(c => c.status === "DRAFT");
  const preview = previewCampaign && query?.preview ? await previewCampaignRecipients(user.id, eventId, previewCampaign.id, selectedIds, Number(query?.previewPage || 1), 10) : null;
  const action = messageActionState;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm underline">← {event.title}</Link>
      <h1 className="mt-4 font-serif text-4xl">Messages</h1>
      <p className="mt-2 text-sm opacity-70">Prepare messages for review. No messages are sent in this phase.</p>

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

      <section className="mt-8"><h2 className="font-serif text-2xl">Campaigns</h2>{campaigns.map(c => <div className="mt-3 flex flex-wrap justify-between rounded-xl bg-white p-4" key={c.id}><span>{c.name} · {c.channel} · {c.status}</span><span className="text-xs opacity-60">{c.recipients.length} recipients</span>{c.recipients.length > 0 && <details className="mt-2 w-full"><summary className="cursor-pointer text-sm underline">Preview saved messages</summary>{c.recipients.slice(0, 10).map(r => <div className="mt-2 rounded border p-2 text-sm" key={r.id}><span className="opacity-60">{r.destination} · {r.status}</span><p>{r.renderedBody}</p></div>)}</details>}{c.status === "DRAFT" && <><MessagingActionForm action={action} label="Save recipients"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="action" value="recipients" /><input type="hidden" name="campaignId" value={c.id} /><input type="hidden" name="eventName" value={event.title} /><RecipientSelector rows={directory?.rows || []} eligibleCount={directory?.eligibleCount || 0} excludedCount={directory?.excludedCount || 0} initialSelected={selectedIds} templateBody={c.template?.body} eventId={eventId} channel={c.channel} /></MessagingActionForm><MessagingActionForm action={action} label="Update status"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="action" value="transition" /><input type="hidden" name="campaignId" value={c.id} /><button name="status" value="READY" className="underline">Mark ready</button><button name="status" value="CANCELLED" className="ml-3 text-red-700 underline">Cancel</button></MessagingActionForm></>}</div>)}</section>

      <section className="mt-8 rounded-2xl bg-white p-5"><h2 className="font-serif text-2xl">Recipients</h2><form method="get" className="mt-3 flex flex-wrap gap-2"><select name="channel" defaultValue={channel}><option>SMS</option><option>WHATSAPP</option><option>EMAIL</option></select><input name="q" defaultValue={q} placeholder="Search name or contact" className="rounded border px-3 py-2" /><button className="rounded-full bg-rose-gold px-4 py-2 text-white">Search</button></form><p className="mt-2 text-sm opacity-70">Eligible: {directory?.eligibleCount || 0} · Excluded: {directory?.excludedCount || 0} · Page {directory?.page || 1} of {directory?.pages || 1}</p>{directory?.rows.map(r => <div className="mt-2 border-b py-2" key={`${r.kind}-${r.id}`}>{r.name} <span className="text-sm opacity-70">({r.kind}) · {r.contact || "Missing contact"} · {r.consent}</span></div>)}<div className="mt-3 flex gap-3">{page > 1 && <Link href={`?q=${encodeURIComponent(q)}&channel=${channel}&selected=${encodeURIComponent(selectedIds.join(","))}&page=${page - 1}`}>Previous</Link>}{directory && page < directory.pages && <Link href={`?q=${encodeURIComponent(q)}&channel=${channel}&selected=${encodeURIComponent(selectedIds.join(","))}&page=${page + 1}`}>Next</Link>}</div></section>

      {preview && <PreviewPanel preview={preview} eventId={eventId} channel={channel} audience="GUESTS" selected={selectedIds} />}
    </main>
  );
}
