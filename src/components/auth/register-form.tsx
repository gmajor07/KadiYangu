"use client";
import { useActionState } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/app/(auth)/register/actions";
import { buttonClass } from "@/components/ui/button";
export function RegisterForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerAction, {
    ok: false,
    message: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (state.ok) router.replace("/login?registered=1");
  }, [state.ok, router]);
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
        />
      </div>
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
        <label htmlFor="phone">
          Phone number <span className="font-normal">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={20}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="password-help" className="pr-20" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-rose-gold underline" aria-pressed={showPassword} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p id="password-help" className="mt-2 text-xs text-forest/70">
          Use 12–128 characters. A unique passphrase works well.
        </p>
      </div>
      <p
        role="status"
        className={state.ok ? "text-sm text-forest" : "text-sm text-red-800"}
      >
        {state.message}
      </p>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
