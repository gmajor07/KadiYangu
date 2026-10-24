import { describe, expect, it, vi } from "vitest";
import { digest, migrateFile } from "../scripts/migrate-local-media-to-r2.cjs";

const file = "public/uploads/hero/3f366061-b0ad-41d1-a29d-99f0c75eb513.jpg";
const body = (bytes: Buffer) => ({ transformTo: async () => bytes });
const config = (send: ReturnType<typeof vi.fn>) => ({ bucket: "kadiyangu-media", base: "https://media.example.test", client: { send } });

describe("R2 media migration collision safety", () => {
  it("uploads a missing object and verifies its full content", async () => {
    const bytes = Buffer.from(require("node:fs").readFileSync(file));
    const send = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Body: body(bytes) });
    const result = await migrateFile(config(send), require("node:path").resolve(file), true);
    expect(result.status).toBe("uploaded_and_verified");
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("skips an identical existing object", async () => {
    const bytes = Buffer.from(require("node:fs").readFileSync(file));
    const send = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ Body: body(bytes) });
    const result = await migrateFile(config(send), require("node:path").resolve(file), true);
    expect(result.status).toBe("already_verified");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("rejects a different existing object without putting", async () => {
    const send = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ Body: body(Buffer.from("different")) });
    await expect(migrateFile(config(send), require("node:path").resolve(file), true)).rejects.toMatchObject({ code: "R2_OBJECT_COLLISION" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("handles a conditional-create race only when the winner is identical", async () => {
    const bytes = Buffer.from(require("node:fs").readFileSync(file));
    const race = Object.assign(new Error("precondition"), { name: "PreconditionFailed", $metadata: { httpStatusCode: 412 } });
    const send = vi.fn().mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } })).mockRejectedValueOnce(race).mockResolvedValueOnce({}).mockResolvedValueOnce({ Body: body(bytes) });
    const result = await migrateFile(config(send), require("node:path").resolve(file), true);
    expect(result.status).toBe("already_verified");
  });

  it("fails on provider errors and post-upload verification mismatch", async () => {
    const network = vi.fn().mockRejectedValue(new Error("network unavailable"));
    await expect(migrateFile(config(network), require("node:path").resolve(file), true)).rejects.toThrow("network unavailable");
    const mismatch = Buffer.from("wrong object");
    const verifyFailure = vi.fn().mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } })).mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({ Body: body(mismatch) });
    await expect(migrateFile(config(verifyFailure), require("node:path").resolve(file), true)).rejects.toThrow("verification failed");
  });
});
