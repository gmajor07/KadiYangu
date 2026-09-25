-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('DRAFT', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "designData" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "orientation" "TemplateOrientation" NOT NULL,
    "thumbnailUrl" TEXT,
    "status" "DesignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Design_userId_status_updatedAt_idx" ON "Design"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Design_templateId_idx" ON "Design"("templateId");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
