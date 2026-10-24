import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { contributionSummary } from "@/services/contributions";
export default async function ContributorDetail({ params }: { params: Promise<{ eventId: string; contributorId: string }> }) {
  const user = await requireUser(); const { eventId, contributorId } = await params;
  const summary = await contributionSummary(user.id, eventId);
  const contributor = summary && await getDb().eventContributor.findFirst({ where: { id: contributorId, eventId }, include: { guest: { select: { name: true, email: true, phone: true } }, pledges: { orderBy: { createdAt: "desc" } }, payments: { orderBy: { paymentDate: "desc" } } } });
  if (!summary || !contributor) notFound();
  const pledged = contributor.pledges.filter(p => p.status !== "CANCELLED").reduce((n, p) => n + p.amount, 0); const confirmed = contributor.payments.filter(p => p.verificationStatus === "CONFIRMED").reduce((n, p) => n + p.amount, 0);
  return <main className="mx-auto max-w-4xl px-6 py-10"><Link href={`/dashboard/events/${eventId}/contributions`} className="text-sm underline">← Contributions</Link><h1 className="mt-4 font-serif text-4xl">{contributor.fullName}</h1><p className="mt-2 text-sm opacity-70">{contributor.phone || contributor.email || "No contact details"}{contributor.guest ? ` · Guest: ${contributor.guest.name}` : ""}</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-4">Pledged<br/><b>TZS {pledged.toLocaleString()}</b></div><div className="rounded-2xl bg-white p-4">Confirmed<br/><b>TZS {confirmed.toLocaleString()}</b></div><div className="rounded-2xl bg-white p-4">Outstanding<br/><b>TZS {Math.max(pledged - confirmed, 0).toLocaleString()}</b></div></div><section className="mt-8 rounded-2xl bg-white p-5"><h2 className="font-semibold">Pledge history</h2>{contributor.pledges.map(p => <div className="mt-3 flex justify-between border-t pt-2 text-sm" key={p.id}><span>TZS {p.amount.toLocaleString()}</span><span>{p.status} · {p.createdAt.toLocaleDateString()}</span></div>)}</section><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-semibold">Payment history</h2>{contributor.payments.map(p => <div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-2 text-sm" key={p.id}><span>TZS {p.amount.toLocaleString()} · {p.method}</span><span>{p.verificationStatus} · {p.paymentDate.toLocaleDateString()}</span></div>)}</section></main>;
}
