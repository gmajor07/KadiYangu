import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
export const metadata = { title: "Sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome back.</h1>
      <p className="mt-3 text-forest/70">Sign in to your KadiYangu account.</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800">
          Your account or sign-in is unavailable. Please try again.
        </p>
      )}
      <LoginForm callbackUrl={callbackUrl} />
      <p className="mt-6 text-sm">
        New here?{" "}
        <Link href="/register" className="underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
