import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/db", () => ({ getDb: mocks.db }));
import { saveCategory, saveTemplate } from "@/services/catalog-admin";
beforeEach(() => {
  vi.resetAllMocks();
});
it.each([saveCategory, saveTemplate])(
  "denies catalog mutations before accessing the database",
  async (save) => {
    mocks.guard.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(save({ role: "ADMIN" })).rejects.toThrow("NOT_FOUND");
    expect(mocks.db).not.toHaveBeenCalled();
  },
);
it("validates admin category writes server-side", async () => {
  mocks.guard.mockResolvedValue({ role: "ADMIN" });
  const result = await saveCategory({ name: "" });
  expect(result.ok).toBe(false);
  expect(mocks.db).not.toHaveBeenCalled();
});
it("rejects invalid prices before a database write", async () => {
  mocks.guard.mockResolvedValue({ role: "ADMIN" });
  const result = await saveTemplate({ isPremium: true, price: -20 });
  expect(result.ok).toBe(false);
  expect(mocks.db).not.toHaveBeenCalled();
});
