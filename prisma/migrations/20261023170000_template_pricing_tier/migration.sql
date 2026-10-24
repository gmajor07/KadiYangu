ALTER TYPE "PricingTier" ADD VALUE IF NOT EXISTS 'FREE';
ALTER TABLE "Template" ADD COLUMN "pricingTier" "PricingTier";

-- Existing rows intentionally remain NULL. They must be reviewed by slug
-- before assigning FREE, STANDARD, PREMIUM or CUSTOM.
