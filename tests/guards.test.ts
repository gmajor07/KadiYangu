import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ user: { findUnique: mocks.user } }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { requireUser, requireAdmin } from "@/lib/auth/guards";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "123" } });
});
it("redirects guests before touching the database", async () => {
  mocks.session.mockResolvedValue(null);
  await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  expect(mocks.user).not.toHaveBeenCalled();
});
it("denies USER on the actual admin guard", async () => {
  mocks.user.mockResolvedValue({ role: "USER", status: "ACTIVE" });
  await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
});
it("permits an active ADMIN", async () => {
  mocks.user.mockResolvedValue({ id: "123", role: "ADMIN", status: "ACTIVE" });
  await expect(requireAdmin()).resolves.toMatchObject({ role: "ADMIN" });
});
it("rechecks suspension despite an existing session", async () => {
  mocks.user.mockResolvedValue({ role: "ADMIN", status: "SUSPENDED" });
  await expect(requireAdmin()).rejects.toThrow("AccountUnavailable");
});
it("denies deleted accounts", async () => {
  mocks.user.mockResolvedValue(null);
  await expect(requireUser()).rejects.toThrow("AccountUnavailable");
});
