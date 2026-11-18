-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('WEBSITE_WEB_APP', 'MOBILE_APP', 'ONLINE_STORE', 'BUSINESS_SYSTEM', 'AI_AUTOMATION', 'CUSTOM_SOFTWARE', 'SAAS_PLATFORM', 'LAB_PRODUCT', 'MAINTENANCE_SUPPORT', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('ENGLISH', 'SINHALA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'WEBSITE_FORM';
ALTER TYPE "LeadSource" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "language" "PreferredLanguage" NOT NULL DEFAULT 'ENGLISH';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "serviceType" "ServiceType",
ADD COLUMN     "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "disqualifyReason" TEXT,
ADD COLUMN     "language" "PreferredLanguage" NOT NULL DEFAULT 'ENGLISH',
ADD COLUMN     "respondBy" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "serviceType" "ServiceType",
ADD COLUMN     "whatsapp" TEXT;

-- CreateIndex
CREATE INDEX "Lead_respondBy_idx" ON "Lead"("respondBy");
