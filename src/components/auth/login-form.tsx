"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
export function LoginForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: data.get("email"),
        password: data.get("password"),
        redirect: false,
        callbackUrl,
      });
      if (result?.ok && !result.error) {
        router.push(callbackUrl);
        router.refresh();
        return;
      }
      setError("Unable to sign in. Check your details or try again later.");
    } catch {
      setError("Sign-in is unavailable. Please try again later.");
    }
    setPending(false);
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required minLength={12} maxLength={128} className="pr-20" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-rose-gold underline" aria-pressed={showPassword} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <p role="alert" className="text-sm text-red-800">
        {error}
      </p>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
