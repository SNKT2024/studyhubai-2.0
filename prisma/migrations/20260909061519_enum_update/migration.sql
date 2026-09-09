/*
  Warnings:

  - The values [INTERVIEW_SCENARIO] on the enum `QuestionFormat` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuestionFormat_new" AS ENUM ('MCQ', 'SENTENCE_BASED', 'INTERVIEW_BASED');
ALTER TABLE "questionset" ALTER COLUMN "format" TYPE "QuestionFormat_new" USING ("format"::text::"QuestionFormat_new");
ALTER TYPE "QuestionFormat" RENAME TO "QuestionFormat_old";
ALTER TYPE "QuestionFormat_new" RENAME TO "QuestionFormat";
DROP TYPE "public"."QuestionFormat_old";
COMMIT;
