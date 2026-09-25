import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
export async function allowAuthAttempt(
  scope: string,
  identity: string,
  limit: number,
) {
  const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthRateLimit"."expiresAt" <= NOW() THEN 1 ELSE "AuthRateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "AuthRateLimit"."expiresAt" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}
