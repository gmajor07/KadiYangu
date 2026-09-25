import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  await requireAdmin();
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <p className="eyebrow">Administration</p>
      <h1 className="mt-4 text-4xl font-semibold">Manage the collection.</h1>
      <p className="mt-4 text-forest/70">
        You have administrator access. Manage the designs and celebrations
        people can discover.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {[
          [
            "Event categories",
            "Create, reorder, and activate celebration categories.",
            "/admin/categories",
          ],
          [
            "Invitation templates",
            "Manage previews, prices, publication status, and featured designs.",
            "/admin/templates",
          ],
        ].map(([title, copy, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-forest/15 bg-white p-7 hover:border-forest/50"
          >
            <h2 className="text-xl font-semibold">{title} ↗</h2>
            <p className="mt-3 text-sm leading-7 text-forest/70">{copy}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
