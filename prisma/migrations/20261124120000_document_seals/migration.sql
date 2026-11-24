-- Company seal on quotes, invoices and receipts, and each sealer's signature.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signatureUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSignature" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSignature_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DocumentSeal" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "sealedById" TEXT,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signature" BYTEA NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSeal_quoteId_key" ON "DocumentSeal"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSeal_invoiceId_key" ON "DocumentSeal"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSeal_paymentId_key" ON "DocumentSeal"("paymentId");

-- AddForeignKey
ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_sealedById_fkey" FOREIGN KEY ("sealedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One document per seal
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_one_document" CHECK (num_nonnulls("quoteId", "invoiceId", "paymentId") = 1);
