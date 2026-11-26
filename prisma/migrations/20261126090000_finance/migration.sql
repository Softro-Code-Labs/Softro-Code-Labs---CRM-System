-- Finance: sales commissions (earned when clients pay), business expenses with receipts,
-- the LKR amount credited for foreign-currency payments, and commission and tax rates in Settings.
-- CreateEnum
CREATE TYPE "CommissionRole" AS ENUM ('SELLER', 'MANAGER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARIES', 'RENT', 'UTILITIES', 'INTERNET_PHONE', 'SOFTWARE', 'HOSTING', 'EQUIPMENT', 'MARKETING', 'TRAVEL', 'PROFESSIONAL_FEES', 'BANK_CHARGES', 'GOVERNMENT_FEES', 'OFFICE', 'OTHER');

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "commissionLeaderPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
ADD COLUMN     "commissionManagerPercent" DECIMAL(5,2) NOT NULL DEFAULT 4,
ADD COLUMN     "commissionSalesPercent" DECIMAL(5,2) NOT NULL DEFAULT 16,
ADD COLUMN     "exportIncomeTaxPercent" DECIMAL(5,2) NOT NULL DEFAULT 15,
ADD COLUMN     "incomeTaxPercent" DECIMAL(5,2) NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "amountLkr" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommissionRole" NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receiptName" TEXT,
    "receiptType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseReceipt" (
    "expenseId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ExpenseReceipt_pkey" PRIMARY KEY ("expenseId")
);

-- CreateIndex
CREATE INDEX "Commission_userId_idx" ON "Commission"("userId");

-- CreateIndex
CREATE INDEX "Commission_paidAt_idx" ON "Commission"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_paymentId_userId_role_key" ON "Commission"("paymentId", "userId", "role");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReceipt" ADD CONSTRAINT "ExpenseReceipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

