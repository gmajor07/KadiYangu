// Run only against the isolated local test database; creates and removes one account.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import pg from "pg";
const base = process.env.SMOKE_URL || "http://localhost:3000";
if (
  process.env.ALLOW_TEST_DATABASE !== "true" ||
  !process.env.DATABASE_URL?.includes("kadiyangu_phase1_test") ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error(
    "Use only the isolated local test database with ALLOW_TEST_DATABASE=true",
  );
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const email = `${randomUUID()}@example.test`;
const id = randomUUID();
const password = randomBytes(24).toString("hex");
const salt = randomBytes(16).toString("hex");
const encoded = `scrypt-v1$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 67108864 }).toString("hex")}`;
const cookies = new Map();
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    redirect: "manual",
    headers: {
      ...options.headers,
      cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const part = cookie.split(";")[0];
    const index = part.indexOf("=");
    cookies.set(part.slice(0, index), part.slice(index + 1));
  }
  return response;
}
async function signIn(pass) {
  const csrf = await (await request("/api/auth/csrf")).json();
  return request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password: pass,
      callbackUrl: `${base}/dashboard`,
      json: "true",
    }),
  });
}
try {
  for (const path of [
    "/",
    "/about",
    "/privacy",
    "/terms",
    "/login",
    "/register",
    "/icon.svg",
    "/robots.txt",
    "/sitemap.xml",
  ])
    assert.equal((await request(path)).status, 200, path);
  const home = await request("/");
  assert.match(home.headers.get("x-robots-tag") || "", /noindex/);
  const homeHtml = await home.text();
  const stylesheet = homeHtml.match(/href="([^" ]+\.css[^" ]*)"/);
  assert.ok(stylesheet, "HTML references a built stylesheet");
  assert.equal(
    (await request(stylesheet[1].replaceAll("&amp;", "&"))).status,
    200,
  );
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, "connected");
  assert.equal((await request("/dashboard")).status, 307);
  assert.equal((await request("/admin")).status, 307);
  await pool.query(
    'INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW())',
    [id, "Smoke Test", email, encoded],
  );
  await signIn("wrong-long-password");
  assert.equal((await request("/dashboard")).status, 307);
  await signIn(password);
  assert.ok((await (await request("/api/auth/session")).json()).user.id);
  assert.match(
    await (await request("/dashboard")).text(),
    /Your account is ready/,
  );
  // Next may stream a not-found page with HTTP 200; verify no admin content leaks.
  const denied = await (await request("/admin")).text();
  assert.match(denied, /Page not available/);
  assert.doesNotMatch(denied, /You have administrator access/);
  await pool.query("UPDATE \"User\" SET role = 'ADMIN' WHERE id = $1", [id]);
  assert.match(
    await (await request("/admin")).text(),
    /You have administrator access/,
  );
  await pool.query("UPDATE \"User\" SET status = 'SUSPENDED' WHERE id = $1", [
    id,
  ]);
  assert.equal((await request("/dashboard")).status, 307);
  assert.equal((await request("/admin")).status, 307);
  await pool.query("UPDATE \"User\" SET status = 'ACTIVE' WHERE id = $1", [id]);
  const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      callbackUrl: `${base}/login`,
      json: "true",
    }),
  });
  assert.equal((await request("/dashboard")).status, 307);
  console.log(
    "PASS: public routes, live health, guest protection, wrong password, login/session, USER denial, ADMIN access, immediate suspension, logout",
  );
} finally {
  await pool.query('DELETE FROM "User" WHERE id = $1', [id]);
  await pool.end();
}
