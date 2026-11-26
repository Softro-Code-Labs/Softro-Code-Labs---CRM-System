-- Expenses and the income tax estimate move out of the CRM: bookkeeping and tax stay with the accountant.
-- Drops the expense tables (and their receipts) and the tax-rate settings. Commission is unchanged.
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseReceipt" DROP CONSTRAINT "ExpenseReceipt_expenseId_fkey";

-- AlterTable
ALTER TABLE "OrgSettings" DROP COLUMN "exportIncomeTaxPercent",
DROP COLUMN "incomeTaxPercent";

-- DropTable
DROP TABLE "Expense";

-- DropTable
DROP TABLE "ExpenseReceipt";

-- DropEnum
DROP TYPE "ExpenseCategory";

