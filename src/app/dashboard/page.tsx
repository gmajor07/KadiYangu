import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/auth/logout-button";
export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};
export default async function Dashboard() {
  const user = await requireUser();
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap justify-between gap-5">
        <div>
          <p className="text-sm text-forest/60">Your dashboard</p>
          <h1 className="mt-2 text-4xl font-semibold">Welcome, {user.name}.</h1>
        </div>
        <LogoutButton />
      </div>
      <div className="mt-10 rounded-2xl border border-forest/15 bg-white p-8">
        <h2 className="text-xl font-semibold">Your account is ready.</h2>
        <p className="mt-3 max-w-xl leading-7 text-forest/70">
          Explore invitation designs and find your celebration. The card editor
          and event management will arrive in later phases.
        </p>
        <Link
          href="/templates"
          className="mt-5 inline-block rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white"
        >
          Browse invitation templates
        </Link>
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
