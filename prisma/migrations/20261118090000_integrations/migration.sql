-- Step 8: notifications and integrations

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dailyDigest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "calendarTokenHash" TEXT;

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "chatWebhookUrl" TEXT,
ADD COLUMN     "chatNotifyLeads" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatNotifyWins" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatNotifyTickets" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestLastRunAt" TIMESTAMP(3),
ADD COLUMN     "digestLastSent" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarTokenHash_key" ON "User"("calendarTokenHash");
