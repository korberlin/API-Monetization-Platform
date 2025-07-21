/*
  Warnings:

  - You are about to drop the `ApiKey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UsageHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ApiKey" DROP CONSTRAINT "ApiKey_customerId_fkey";

-- DropForeignKey
ALTER TABLE "UsageHistory" DROP CONSTRAINT "UsageHistory_customerId_fkey";

-- DropTable
DROP TABLE "ApiKey";

-- DropTable
DROP TABLE "UsageHistory";

-- CreateTable
CREATE TABLE "apiKey" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "customerId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usageHistory" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "apiKeyId" INTEGER,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apiKey_key_key" ON "apiKey"("key");

-- CreateIndex
CREATE INDEX "apiKey_key_idx" ON "apiKey"("key");

-- CreateIndex
CREATE INDEX "apiKey_customerId_idx" ON "apiKey"("customerId");

-- CreateIndex
CREATE INDEX "usageHistory_customerId_timestamp_idx" ON "usageHistory"("customerId", "timestamp");

-- CreateIndex
CREATE INDEX "usageHistory_timestamp_idx" ON "usageHistory"("timestamp");

-- AddForeignKey
ALTER TABLE "apiKey" ADD CONSTRAINT "apiKey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usageHistory" ADD CONSTRAINT "usageHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
