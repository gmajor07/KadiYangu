"use client";
import { useActionState } from "react";
import { registerAction } from "@/app/(auth)/register/actions";
import { buttonClass } from "@/components/ui/button";
export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {
    ok: false,
    message: "",
  });
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          aria-describedby="password-help"
        />
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
