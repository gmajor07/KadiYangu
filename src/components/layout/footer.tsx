import Link from "next/link";
export function Footer() {
  return (
    <footer className="mt-auto border-t border-forest/10">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-2">
        <div>
          <Link href="/" className="text-2xl font-bold tracking-tight">
            kadi<span className="font-normal">yangu</span>.
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-7 text-forest/70">
            A little invitation. A meaningful connection.
            <br />
            Made for the moments that bring us together.
          </p>
          <p className="mt-5 text-xs text-forest/60">
            © {new Date().getFullYear()} KadiYangu
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-start gap-x-7 gap-y-4 text-sm md:justify-end"
        >
          {[
            ["Templates", "/templates"],
            ["Categories", "/categories"],
            ["About", "/about"],
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
          ].map(([title, href]) => (
            <Link key={href} href={href} className="hover:underline">
              {title}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
