-- Project access register and handover documents

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TwoStepMethod" AS ENUM ('AUTHENTICATOR', 'SECURITY_KEY', 'SMS', 'NONE');
CREATE TYPE "ServiceCategory" AS ENUM ('DOMAIN', 'HOSTING', 'CODE', 'DATABASE', 'EMAIL', 'PAYMENTS', 'STORAGE', 'ANALYTICS', 'OTHER');
CREATE TYPE "SignInMethod" AS ENUM ('GOOGLE', 'PASSWORD_IN_GOOGLE', 'OTHER');
CREATE TYPE "AccountOwner" AS ENUM ('SOFTRO', 'CLIENT', 'SHARED');

-- CreateTable
CREATE TABLE "ProjectAccess" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "googleEmail" TEXT,
    "recoveryEmail" TEXT,
    "recoveryPhone" TEXT,
    "twoStep" "TwoStepMethod" NOT NULL DEFAULT 'AUTHENTICATOR',
    "secretsLocation" TEXT,
    "envLocation" TEXT,
    "notes" TEXT,
    "passwordsSaved" BOOLEAN NOT NULL DEFAULT false,
    "backupCodesSaved" BOOLEAN NOT NULL DEFAULT false,
    "envSaved" BOOLEAN NOT NULL DEFAULT false,
    "clientHandedOver" BOOLEAN NOT NULL DEFAULT false,
    "browserProfileGone" BOOLEAN NOT NULL DEFAULT false,
    "localFilesDeleted" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckedById" TEXT,
    "reviewTaskId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectService" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL DEFAULT 'OTHER',
    "url" TEXT,
    "loginEmail" TEXT,
    "signIn" "SignInMethod" NOT NULL DEFAULT 'GOOGLE',
    "owner" "AccountOwner" NOT NULL DEFAULT 'SOFTRO',
    "renewsAt" TIMESTAMP(3),
    "renewalTaskId" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccess_dealId_key" ON "ProjectAccess"("dealId");
CREATE INDEX "ProjectAccess_status_idx" ON "ProjectAccess"("status");
CREATE INDEX "ProjectService_accessId_idx" ON "ProjectService"("accessId");
CREATE INDEX "ProjectService_renewsAt_idx" ON "ProjectService"("renewsAt");
CREATE UNIQUE INDEX "Handover_number_key" ON "Handover"("number");
CREATE INDEX "Handover_accessId_idx" ON "Handover"("accessId");

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_lastCheckedById_fkey" FOREIGN KEY ("lastCheckedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ProjectAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ProjectAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
