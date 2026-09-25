import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { registerUser } from "@/services/registration";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
it("registers a safe default account and handles duplicates and concurrent throttling", async () => {
  if (
    process.env.ALLOW_TEST_DATABASE !== "true" ||
    !process.env.DATABASE_URL?.includes("kadiyangu_phase1_test")
  )
    throw new Error(
      "Use the isolated test database and set ALLOW_TEST_DATABASE=true",
    );
  const email = `${randomUUID()}@example.test`;
  const input = {
    name: "Integration Test",
    email,
    password: "test-only-long-passphrase",
    phone: "+255700000000",
  };
  const db = getDb();
  try {
    expect((await registerUser({ ...input, role: "ADMIN" })).ok).toBe(false);
    const result = await registerUser(input);
    expect(result.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("USER");
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerified).toBeNull();
    expect(await verifyPassword(input.password, user.passwordHash)).toBe(true);
    expect(await registerUser(input)).toEqual(result);
    expect(await db.user.count({ where: { email } })).toBe(1);
    const attempts = await Promise.all(
      Array.from({ length: 12 }, () => allowAuthAttempt("test", email, 5)),
    );
    expect(attempts.filter(Boolean)).toHaveLength(5);
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
}, 30000);
