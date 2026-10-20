CREATE TABLE "HeroSlide" (
  "id" TEXT NOT NULL,
  "imageUrl" VARCHAR(500) NOT NULL,
  "altText" VARCHAR(200) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HeroSlide_isActive_sortOrder_idx" ON "HeroSlide"("isActive", "sortOrder");
