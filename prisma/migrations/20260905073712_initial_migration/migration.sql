-- CreateEnum
CREATE TYPE "ContextMode" AS ENUM ('NORMAL', 'EXAM_REVISION', 'INTERVIEW_BASED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studychat" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "contextMode" "ContextMode" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responseId" TEXT,

    CONSTRAINT "studychat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studymessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "modeUsed" "ContextMode" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studymessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studychat_userId_idx" ON "studychat"("userId");

-- CreateIndex
CREATE INDEX "studymessage_chatId_idx" ON "studymessage"("chatId");

-- AddForeignKey
ALTER TABLE "studychat" ADD CONSTRAINT "studychat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studymessage" ADD CONSTRAINT "studymessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "studychat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
