-- AlterTable
ALTER TABLE "creditledger" ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "ratelimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratelimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ratelimit_expiresAt_idx" ON "ratelimit"("expiresAt");
