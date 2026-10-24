-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "publicTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_publicTokenHash_key" ON "Artifact"("publicTokenHash");

