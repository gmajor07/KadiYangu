import Link from "next/link";
export const buttonClass =
  "inline-flex items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#236658] focus-visible:outline-2 focus-visible:outline-forest";
export function ButtonLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={buttonClass} href={href}>
      {children}
    </Link>
  );
}
