import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

describe("Prisma messaging delegates", () => {
  it("exposes Phase 7E.3 messaging models at runtime", () => {
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: "postgresql://localhost:5432/kadiyangu_phase7e1_test" }) });
    expect(typeof client.messageTemplate?.findMany).toBe("function");
    expect(typeof client.messageCampaign?.findMany).toBe("function");
    expect(typeof client.messageRecipient?.findMany).toBe("function");
    expect(typeof client.messageConsent?.findMany).toBe("function");
  });
});
