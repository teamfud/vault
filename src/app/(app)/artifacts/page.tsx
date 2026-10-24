import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listArtifacts } from "@/lib/artifacts";
import { Card, PageHeader } from "@/components/ui";
import { ArtifactTable } from "@/components/ArtifactTable";
import { ArtifactUpload } from "@/components/ArtifactUpload";

export default async function ArtifactsPage() {
  await requireUser();
  const [rows, boxes] = await Promise.all([
    listArtifacts(),
    db.box.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="artifacts" sub="tools, scripts, configs. encrypted at rest, public only if u say so" />
      <Card className="mb-5 p-5">
        <h2 className="mb-3 font-display text-lg">upload</h2>
        <ArtifactUpload boxes={boxes} existing={rows} />
      </Card>
      <ArtifactTable rows={rows} boxes={boxes} />
    </>
  );
}
