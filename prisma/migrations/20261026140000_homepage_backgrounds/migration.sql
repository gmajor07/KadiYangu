-- Additive: all existing slides remain CARD slides.
ALTER TABLE "HeroSlide" ADD COLUMN "placement" VARCHAR(20) NOT NULL DEFAULT 'CARD';
CREATE INDEX "HeroSlide_placement_isActive_sortOrder_idx" ON "HeroSlide"("placement", "isActive", "sortOrder");
