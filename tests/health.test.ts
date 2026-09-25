import { beforeEach, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ getDb: () => ({ $queryRaw: query }) }));
import { GET } from "@/app/api/health/route";
beforeEach(() => {
  query.mockReset();
});
it("returns database readiness without caching", async () => {
  query.mockResolvedValue([{ "?column?": 1 }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    app: "KadiYangu",
    database: "connected",
  });
});
it("fails safely when the database is unavailable", async () => {
  query.mockRejectedValue(
    new Error("postgresql://secret-password@private-host"),
  );
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).toContain("unavailable");
  expect(body).not.toContain("secret-password");
  expect(body).not.toContain("private-host");
});
