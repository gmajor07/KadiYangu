import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listOwnedDesigns } from "@/services/designs";
export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};
export default async function Dashboard() {
  const user = await requireUser();
  const designs = await listOwnedDesigns(user.id);
  const drafts = designs.filter((design) => design.status === "DRAFT");
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap justify-between gap-5">
        <div>
          <p className="text-sm text-forest/60">Your dashboard</p>
          <h1 className="mt-2 text-4xl font-semibold">Welcome, {user.name}.</h1>
        </div>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3"><Link href="/my-designs" className="rounded-2xl border border-forest/15 bg-white p-5"><span className="text-sm text-forest/60">My Designs</span><strong className="mt-2 block text-3xl">{designs.length}</strong></Link><Link href="/my-designs" className="rounded-2xl border border-forest/15 bg-white p-5"><span className="text-sm text-forest/60">Recent Designs</span><strong className="mt-2 block text-3xl">{Math.min(designs.length, 5)}</strong></Link><Link href="/my-designs" className="rounded-2xl border border-forest/15 bg-white p-5"><span className="text-sm text-forest/60">Draft Designs</span><strong className="mt-2 block text-3xl">{drafts.length}</strong></Link></div><div className="mt-6 rounded-2xl border border-forest/15 bg-white p-8">
        <h2 className="text-xl font-semibold">Your account is ready.</h2>
        <p className="mt-3 max-w-xl leading-7 text-forest/70">
          Explore templates, create invitations and continue editing your saved designs.
        </p>
        <Link
          href="/templates"
          className="mt-5 inline-block rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white"
        >
          Browse invitation templates
        </Link>
        <Link href="/dashboard/designs" className="ml-3 mt-5 inline-block rounded-full border border-forest/20 px-5 py-3 text-sm font-semibold">My Designs</Link>
        <div className="mt-8 border-t border-forest/10 pt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent Designs</h2><Link href="/my-designs" className="text-sm font-semibold underline">View all designs</Link></div>{designs.slice(0, 4).length === 0 ? <p className="mt-4 text-sm text-forest/65">No designs yet. Choose a template to create your first invitation.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{designs.slice(0, 4).map((design) => <Link key={design.id} href={`/editor/${design.id}`} className="flex items-center gap-3 rounded-xl border border-forest/10 p-3"><div className="h-14 w-14 overflow-hidden rounded-lg bg-[#ece8de]">{design.thumbnailUrl && <img src={design.thumbnailUrl} alt="" className="h-full w-full object-cover" />}</div><span className="min-w-0"><strong className="block truncate text-sm">{design.name}</strong><small className="text-xs text-forest/60">{design.status} · {design.updatedAt.toLocaleDateString()}</small></span></Link>)}</div>}</div>
        <p className="mt-5 text-sm">Signed in as {user.email}</p>
        {user.role === "ADMIN" && (
          <Link
            className="mt-5 inline-block font-semibold underline"
            href="/admin"
          >
            Open administration
          </Link>
        )}
      </div>
    </section>
  );
}
