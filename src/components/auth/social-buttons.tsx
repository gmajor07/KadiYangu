"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.22Z"/><path fill="#34A853" d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.6Z"/><path fill="#FBBC05" d="M6.53 13.68a5.85 5.85 0 0 1 0-3.36V7.79H3.28a9.61 9.61 0 0 0 0 8.42l3.25-2.53Z"/><path fill="#EA4335" d="M12 6.29c1.43 0 2.7.49 3.71 1.45l2.78-2.78C16.84 3.36 14.63 2.4 12 2.4a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.01 9.46 6.29 12 6.29Z"/></svg>;
}
function FacebookIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.52-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.46h-2.79v8.39A12 12 0 0 0 24 12Z"/><path fill="white" d="m16.65 15.46.53-3.46h-3.32V9.75c0-.95.46-1.87 1.95-1.87h1.51V4.93s-1.37-.23-2.68-.23c-2.73 0-4.52 1.66-4.52 4.66V12H7.08v3.46h3.04v8.39a12.13 12.13 0 0 0 3.74 0v-8.39h2.79Z"/></svg>;
}

export function SocialButtons({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [error, setError] = useState("");
  const login = async (provider: "google" | "facebook") => { setError(""); const result = await signIn(provider, { callbackUrl }); if (result?.error) setError("Social sign-in is not configured or unavailable."); };
  return <div className="mt-6 space-y-3"><div className="flex items-center gap-3 text-xs text-forest/50"><span className="h-px flex-1 bg-forest/15" />or continue with<span className="h-px flex-1 bg-forest/15" /></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => login("google")} className="flex items-center justify-center gap-3 rounded-full border border-forest/20 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#f7f5ef]"><GoogleIcon />Continue with Google</button><button type="button" onClick={() => login("facebook")} className="flex items-center justify-center gap-3 rounded-full border border-forest/20 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#f7f5ef]"><FacebookIcon />Continue with Facebook</button></div>{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>;
}
