-- CreateEnum
CREATE TYPE "QuestionFormat" AS ENUM ('MCQ', 'SENTENCE_BASED', 'INTERVIEW_SCENARIO');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('FRESHER_0_1', 'EXPERIENCED_3_PLUS');

-- CreateTable
CREATE TABLE "questionset" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "topic" TEXT NOT NULL,
    "format" "QuestionFormat" NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 10,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questionset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questionset_userId_idx" ON "questionset"("userId");

-- AddForeignKey
ALTER TABLE "questionset" ADD CONSTRAINT "questionset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
