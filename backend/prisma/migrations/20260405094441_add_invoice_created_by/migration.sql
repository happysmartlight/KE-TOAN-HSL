-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "eInvoiceCode" TEXT,
    "invoiceDate" DATETIME,
    "customerId" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("code", "createdAt", "customerId", "eInvoiceCode", "id", "invoiceDate", "note", "paidAmount", "status", "totalAmount", "updatedAt") SELECT "code", "createdAt", "customerId", "eInvoiceCode", "id", "invoiceDate", "note", "paidAmount", "status", "totalAmount", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_code_key" ON "Invoice"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
