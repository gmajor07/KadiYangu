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
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/payments">Payments</Link>
          <Link href="/admin/reports">Reports</Link>
          <Link href="/admin/pricing">Pricing</Link>
          <Link href="/admin/subscription-plans">Subscription plans</Link>
          <Link href="/admin/guest-passes">Guest passes</Link>
          <Link href="/admin/scan-activity">Scan activity</Link>
          <Link href="/admin/beta">Free Beta</Link>
          <Link href="/admin/feedback">Feedback</Link>
          <Link href="/admin/hero-slides">Hero slides</Link>
          <Link href="/admin/homepage-backgrounds">Homepage backgrounds</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
