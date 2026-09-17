-- DropForeignKey
ALTER TABLE "questionset" DROP CONSTRAINT "questionset_userId_fkey";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "creditledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creditledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creditledger_userId_createdAt_idx" ON "creditledger"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "creditledger" ADD CONSTRAINT "creditledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionset" ADD CONSTRAINT "questionset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
