/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "filename" TEXT NOT NULL,
ALTER COLUMN "sessionId" DROP NOT NULL,
ALTER COLUMN "s3Key" DROP NOT NULL,
ALTER COLUMN "originalName" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "File_code_key" ON "File"("code");
