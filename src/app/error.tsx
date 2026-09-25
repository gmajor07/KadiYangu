"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Something went wrong.</h1>
      <p className="my-5">
        The service is temporarily unavailable. Please try again.
      </p>
      <button onClick={reset} className="underline">
        Try again
      </button>
    </div>
  );
}
