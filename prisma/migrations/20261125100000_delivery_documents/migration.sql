-- Warranty and non-disclosure agreement wording, edited by admins, optionally added to the Project Delivery Pack.
ALTER TABLE "OrgSettings" ADD COLUMN     "supportMonths" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "warrantyMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "warrantyTerms" TEXT,
ADD COLUMN     "ndaTerms" TEXT;
