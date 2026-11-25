-- The company seal on a Project Delivery Pack (printed on the pack and its warranty and NDA pages).

-- AlterTable
ALTER TABLE "DocumentSeal" ADD COLUMN     "handoverId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSeal_handoverId_key" ON "DocumentSeal"("handoverId");

-- AddForeignKey
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One document per seal
ALTER TABLE "DocumentSeal" DROP CONSTRAINT "DocumentSeal_one_document";
ALTER TABLE "DocumentSeal" ADD CONSTRAINT "DocumentSeal_one_document" CHECK (num_nonnulls("quoteId", "invoiceId", "paymentId", "handoverId") = 1);
