import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: {} as any }));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
import { getAdminOverview } from "@/services/admin-overview";
beforeEach(() => { const count = (value:number) => vi.fn().mockResolvedValue(value); mocks.db = { user:{count:count(7)}, eventCategory:{count:count(8)}, template:{count:count(10)}, design:{count:count(9)}, event:{count:count(4)}, guest:{count:count(12)}, rsvp:{count:count(5)}, order:{count:vi.fn().mockResolvedValueOnce(14).mockResolvedValueOnce(6),aggregate:vi.fn().mockResolvedValue({_sum:{total:125000}}),findMany:vi.fn().mockResolvedValue([])}, payment:{count:vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3),findMany:vi.fn().mockResolvedValue([])} }; });
it("returns database-backed admin metrics and recent records", async()=>{const result=await getAdminOverview();expect(result.metrics).toMatchObject({customers:7,categories:8,publishedTemplates:10,designs:9,events:4,guests:12,rsvps:5,orders:14,paidOrders:6,revenue:125000,pendingPayments:2,failedPayments:3});expect(result.recentOrders).toEqual([]);expect(result.recentPayments).toEqual([]);});
