import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
export const metadata = { title: "Create account" };
export default function Register() {
  return (
    <>
      <h1 className="text-3xl font-semibold">A place to begin.</h1>
      <p className="mt-3 text-forest/70">
        Create your account for early access.
      </p>
      <RegisterForm />
      <p className="mt-5 text-xs leading-6 text-forest/70">
        By registering, you agree to our{" "}
        <Link href="/terms" className="underline">
          staging terms
        </Link>
        . Read our{" "}
        <Link href="/privacy" className="underline">
          privacy notice
        </Link>
        .
      </p>
      <p className="mt-6 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
