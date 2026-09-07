/*
  Warnings:

  - You are about to drop the column `responseId` on the `studychat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,id]` on the table `studychat` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "studychat" DROP COLUMN "responseId",
ADD COLUMN     "latestResponseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "studychat_userId_id_key" ON "studychat"("userId", "id");
