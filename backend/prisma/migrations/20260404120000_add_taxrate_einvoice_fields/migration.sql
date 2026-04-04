-- AlterTable Product: add taxRate
ALTER TABLE "Product" ADD COLUMN "taxRate" TEXT NOT NULL DEFAULT '10%';

-- AlterTable InvoiceItem: add taxRate
ALTER TABLE "InvoiceItem" ADD COLUMN "taxRate" TEXT NOT NULL DEFAULT '10%';

-- AlterTable Invoice: add eInvoiceCode, invoiceDate
ALTER TABLE "Invoice" ADD COLUMN "eInvoiceCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "invoiceDate" DATETIME;
