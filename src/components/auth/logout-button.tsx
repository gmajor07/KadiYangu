"use client";
import { signOut } from "next-auth/react";
export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-full border border-forest/30 px-5 py-2 text-sm font-semibold"
    >
      Sign out
    </button>
  );
}
