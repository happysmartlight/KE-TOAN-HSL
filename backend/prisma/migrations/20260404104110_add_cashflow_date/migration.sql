-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cashflow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refId" INTEGER,
    "refType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Cashflow" ("amount", "category", "createdAt", "description", "id", "refId", "refType", "type") SELECT "amount", "category", "createdAt", "description", "id", "refId", "refType", "type" FROM "Cashflow";
DROP TABLE "Cashflow";
ALTER TABLE "new_Cashflow" RENAME TO "Cashflow";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
