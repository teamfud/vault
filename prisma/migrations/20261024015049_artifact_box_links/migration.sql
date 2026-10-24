-- DropIndex
DROP INDEX "Artifact_boxId_idx";

-- DropIndex
DROP INDEX "Artifact_publicTokenHash_key";

-- AlterTable
ALTER TABLE "Artifact" DROP COLUMN "publicToken",
DROP COLUMN "publicTokenHash",
ADD COLUMN     "public" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "publicTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_boxId_name_key" ON "Artifact"("boxId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Box_publicTokenHash_key" ON "Box"("publicTokenHash");

