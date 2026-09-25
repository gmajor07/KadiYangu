import { ButtonLink } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <h1 className="mb-5 text-3xl font-semibold">Page not available.</h1>
      <p className="mb-7">
        This page could not be found or is not available to your account.
      </p>
      <ButtonLink href="/">Back to home</ButtonLink>
    </div>
  );
}
