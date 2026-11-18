-- Invoices, payments and receipts

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'ONLINE', 'OTHER');

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "invoiceDueDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "invoiceTerms" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "terms" TEXT,
    "notes" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxLabel" TEXT NOT NULL DEFAULT 'VAT',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dealId" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "quoteId" TEXT,
    "contractId" TEXT,
    "createdById" TEXT,
    "followUpTaskId" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'project',
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_dealId_idx" ON "Invoice"("dealId");
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");
CREATE INDEX "Invoice_quoteId_idx" ON "Invoice"("quoteId");
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
