import Link from "next/link";
export function Header() {
  return (
    <header className="border-b border-forest/10 bg-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-5 px-5 py-5">
        <Link
          href="/"
          aria-label="KadiYangu home"
          className="text-2xl font-bold tracking-tight"
        >
          kadi<span className="font-normal">yangu</span>
          <span className="text-[#a66b42]">.</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="order-3 flex w-full justify-center gap-7 text-sm md:order-none md:w-auto"
        >
          <Link href="/templates" className="hover:underline">
            Templates
          </Link>
          <Link href="/categories" className="hover:underline">
            Categories
          </Link>
          <Link href="/#how-it-works" className="hover:underline">
            How it works
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-xs sm:gap-5 sm:text-sm">
          <Link href="/login" className="font-semibold hover:underline">
            Login
          </Link>
          <Link
            href="/templates"
            className="rounded-full bg-forest px-4 py-3 font-semibold text-white hover:bg-[#236658]"
          >
            Create Invitation
          </Link>
        </div>
      </div>
    </header>
  );
}
