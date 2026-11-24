-- Teams (each user can belong to one manager) and who created each lead and deal,
-- for "Sales sees own, Manager sees own and team, Admin sees all".

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");

-- CreateIndex
CREATE INDEX "Deal_createdById_idx" ON "Deal"("createdById");

-- CreateIndex
CREATE INDEX "Quote_createdById_idx" ON "Quote"("createdById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing records: whoever owns them counts as their creator.
UPDATE "Lead" SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "source" <> 'WEBSITE_FORM';
UPDATE "Deal" SET "createdById" = "ownerId" WHERE "createdById" IS NULL;
