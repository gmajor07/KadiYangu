import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { registrationSchema } from "@/lib/validation/auth";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
export async function registerUser(input: unknown) {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message:
        "Check your details. Use a valid email and a password of 12–128 characters.",
    };
  try {
    if (
      !(await allowAuthAttempt("register-total", "global", 50)) ||
      !(await allowAuthAttempt("register", parsed.data.email, 5))
    ) {
      return {
        ok: false,
        message: "Too many attempts. Please try again in 15 minutes.",
      };
    }
    const { name, email, phone, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    await getDb().user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
      },
    });
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
    ) {
      console.error("Registration unavailable");
      return {
        ok: false,
        message:
          "Registration is temporarily unavailable. Please try again later.",
      };
    }
  }
  return {
    ok: true,
    message:
      "If this email was available, your account is ready. You can now try signing in.",
  };
}
