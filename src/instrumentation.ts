export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32 || secret.startsWith("REPLACE_"))
      throw new Error("Set a random AUTH_SECRET of at least 32 characters");
    for (const key of ["DATABASE_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
      if (!process.env[key]) throw new Error(`${key} is required`);
    }
    for (const key of ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
      const url = new URL(process.env[key]!);
      if (
        url.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(url.hostname)
      )
        throw new Error(`${key} must use HTTPS`);
    }
    if (
      new URL(process.env.NEXTAUTH_URL!).origin !==
      new URL(process.env.NEXT_PUBLIC_APP_URL!).origin
    )
      throw new Error("Application URL origins must match");
  }
}
