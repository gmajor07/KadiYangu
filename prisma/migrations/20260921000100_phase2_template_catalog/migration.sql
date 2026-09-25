-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TemplateOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE', 'SQUARE');

-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "previewImageUrl" TEXT,
    "categoryId" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orientation" "TemplateOrientation" NOT NULL DEFAULT 'PORTRAIT',
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1350,
    "designData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- CreateIndex
CREATE INDEX "EventCategory_isActive_sortOrder_idx" ON "EventCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");

-- CreateIndex
CREATE INDEX "Template_categoryId_status_isActive_idx" ON "Template"("categoryId", "status", "isActive");

-- CreateIndex
CREATE INDEX "Template_status_isActive_isFeatured_createdAt_idx" ON "Template"("status", "isActive", "isFeatured", "createdAt");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep pricing and canvas invariants even for writes outside the application.
ALTER TABLE "Template" ADD CONSTRAINT "Template_price_check"
CHECK (("isPremium" = false AND "price" IS NULL) OR ("isPremium" = true AND "price" IS NOT NULL AND "price" > 0));
ALTER TABLE "Template" ADD CONSTRAINT "Template_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Template" ADD CONSTRAINT "Template_dimensions_check"
CHECK ("width" BETWEEN 320 AND 8000 AND "height" BETWEEN 320 AND 8000 AND
 (("orientation" = 'PORTRAIT' AND "height" > "width") OR
  ("orientation" = 'LANDSCAPE' AND "width" > "height") OR
  ("orientation" = 'SQUARE' AND "width" = "height")));
