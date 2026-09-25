import Link from "next/link";
export const metadata = { robots: { index: false, follow: false } };
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav
        aria-label="Administration navigation"
        className="border-b border-forest/10 bg-white"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap gap-6 px-6 py-4 text-sm">
          <Link href="/admin" className="font-semibold">
            Administration
          </Link>
          <Link href="/admin/categories">Categories</Link>
          <Link href="/admin/templates">Templates</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
