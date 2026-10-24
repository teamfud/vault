-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "notes" TEXT,
    "boxId" TEXT,
    "uploadedById" TEXT,
    "publicTokenHash" TEXT,
    "publicToken" TEXT,
    "publicExpiresAt" TIMESTAMP(3),
    "publicHits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactBlob" (
    "artifactId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ArtifactBlob_pkey" PRIMARY KEY ("artifactId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_publicTokenHash_key" ON "Artifact"("publicTokenHash");

-- CreateIndex
CREATE INDEX "Artifact_boxId_idx" ON "Artifact"("boxId");

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactBlob" ADD CONSTRAINT "ArtifactBlob_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
