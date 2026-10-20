import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  HeadObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}));

import { deleteObject, headObject, putImage } from "@/lib/storage";

const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], "card.png", { type: "image/png" });

describe("R2 storage adapter", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; send.mockReset().mockResolvedValue({}); });

  function enableR2() {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
    process.env.R2_BUCKET = "kadiyangu-media";
    process.env.R2_ACCESS_KEY_ID = "test-access";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_PUBLIC_BASE_URL = "https://media.example.test";
  }

  it("uploads valid images and returns a stable public URL", async () => {
    enableR2();
    const result = await putImage("hero", png);
    expect(result.url).toMatch(/^https:\/\/media\.example\.test\/hero\/.+\.png$/);
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as { input: { Bucket: string; ContentType: string } }).input).toMatchObject({ Bucket: "kadiyangu-media", ContentType: "image/png" });
  });

  it("checks and deletes only safe object keys", async () => {
    enableR2();
    expect(await headObject("hero/example.png")).toBe(true);
    await deleteObject("hero/example.png");
    expect(send).toHaveBeenCalledTimes(2);
    expect(await headObject("../secret.png")).toBe(false);
    await expect(deleteObject("../secret.png")).rejects.toThrow("Unsafe object key");
  });

  it("surfaces provider failures and rejects invalid files", async () => {
    enableR2();
    send.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(putImage("hero", png)).rejects.toThrow("provider unavailable");
    const invalid = new File(["not an image"], "bad.png", { type: "image/png" });
    await expect(putImage("hero", invalid)).rejects.toThrow("Image signature");
  });
});
