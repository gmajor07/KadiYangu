export const metadata = { robots: { index: false, follow: false } };
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto max-w-md px-6 py-16">{children}</div>;
}
