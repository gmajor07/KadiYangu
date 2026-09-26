"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["Templates", "/templates"],
  ["Categories", "/categories"],
  ["How It Works", "/#how-it-works"],
] as const;

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeaderNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const linkClass = (href: string) => `relative py-2 transition-colors hover:text-[#236658] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#236658]/40 ${isActive(pathname, href) ? "font-semibold text-[#236658] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-[#236658]" : "text-forest/75"}`;
  return <header className="border-b border-forest/10 bg-cream"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6"><Link href="/" aria-label="KadiYangu home" className="text-2xl font-bold tracking-tight">KADI<span className="font-normal">YANGU</span><span className="text-[#a66b42]">.</span></Link><nav aria-label="Main navigation" className="hidden items-center gap-9 text-sm md:flex">{links.map(([label, href]) => <Link key={href} href={href} className={linkClass(href)}>{label}</Link>)}</nav><div className="hidden items-center gap-6 text-sm md:flex">{authenticated ? <><Link href="/dashboard/designs" className={linkClass("/dashboard/designs")}>My Designs</Link><Link href="/dashboard" className="bg-forest px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#236658] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#236658]/50">Dashboard</Link></> : <><Link href="/login" className="font-semibold text-forest/75 transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#236658]/40">Log in</Link><Link href="/templates" className="bg-forest px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#236658] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#236658]/50">Create a Card</Link></>}</div><button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)} className="p-2 text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#236658]/50 md:hidden"><span className="sr-only">Menu</span><span aria-hidden="true" className="block text-2xl leading-none">{open ? "×" : "☰"}</span></button></div>{open && <nav aria-label="Mobile navigation" className="border-t border-forest/10 px-5 pb-5 pt-3 md:hidden"><div className="flex flex-col gap-1">{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={linkClass(href)}>{label}</Link>)}{authenticated ? <><Link href="/dashboard/designs" onClick={() => setOpen(false)} className={linkClass("/dashboard/designs")}>My Designs</Link><Link href="/dashboard" onClick={() => setOpen(false)} className="mt-2 bg-forest px-4 py-3 text-center font-semibold text-white">Dashboard</Link><button onClick={() => signOut({ callbackUrl: "/" })} className="py-3 text-left text-sm text-forest/75">Log out</button></> : <><Link href="/login" onClick={() => setOpen(false)} className="mt-2 py-2 font-semibold">Log in</Link><Link href="/templates" onClick={() => setOpen(false)} className="bg-forest px-4 py-3 text-center font-semibold text-white">Create a Card</Link></>}</div></nav>}</header>;
}
