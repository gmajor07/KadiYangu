-- Additive Free Beta guest-pass capacity path. Apply only after review.
ALTER TABLE "GuestPassPurchase" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "GuestPassPurchase" ADD COLUMN "betaGrantId" TEXT;
ALTER TABLE "GuestPassPurchase" ADD CONSTRAINT "GuestPassPurchase_betaGrantId_fkey" FOREIGN KEY ("betaGrantId") REFERENCES "BetaGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GuestPassPurchase_betaGrantId_createdAt_idx" ON "GuestPassPurchase"("betaGrantId", "createdAt");
-- Every purchase has exactly one funding source. Existing paid rows retain orderId;
-- beta rows use betaGrantId and never create payment records.
ALTER TABLE "GuestPassPurchase" ADD CONSTRAINT "GuestPassPurchase_one_funding_source_chk"
  CHECK (num_nonnulls("orderId", "betaGrantId") = 1);
