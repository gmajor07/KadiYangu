import { describe, expect, it } from "vitest";
import { grantBetaAccess } from "@/services/beta";
describe("beta grants", () => { it("never grants without admin authorization", async () => { expect(await grantBetaAccess(false, "u", null, new Date(Date.now() + 1000), { designLimit: 1, eventLimit: 1, guestPassLimit: 1 })).toBeNull(); }); });
