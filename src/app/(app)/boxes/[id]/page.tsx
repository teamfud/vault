import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { boxToken, listArtifacts } from "@/lib/artifacts";
import { Card, PageHeader } from "@/components/ui";
import { ArtifactTable } from "@/components/ArtifactTable";
import { ArtifactUpload } from "@/components/ArtifactUpload";
import { BoxPublicLink } from "@/components/BoxPublicLink";
import { CredentialTable } from "./CredentialTable";

export default async function BoxPage({ params }: PageProps<"/boxes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const box = await db.box.findUnique({
    where: { id },
    include: {
      // `secret` is deliberately not selected: plaintext only leaves via revealCredential.
      credentials: {
        select: {
          id: true,
          kind: true,
          service: true,
          username: true,
          notes: true,
          version: true,
          updatedAt: true,
          updatedBy: { select: { username: true } },
        },
        orderBy: [{ kind: "asc" }, { service: "asc" }, { username: "asc" }],
      },
    },
  });
  if (!box) notFound();
  const [artifacts, boxes] = await Promise.all([
    listArtifacts({ boxId: box.id }),
    db.box.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const token = boxToken(box);

  const rows = box.credentials.map((c) => ({
    id: c.id,
    kind: c.kind,
    service: c.service,
    username: c.username,
    notes: c.notes,
    version: c.version,
    updatedBy: c.updatedBy?.username ?? null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <>
      <Link href="/" className="text-xs text-muted hover:text-fg">
        ← all boxes
      </Link>
      <PageHeader title={box.name} sub="the goods">
        <span className="text-muted">{box.address}</span>
        {box.os && <span className="rounded-full border border-muted/60 px-2 text-[11px] leading-[18px] text-muted">{box.os}</span>}
      </PageHeader>
      {box.notes && <p className="-mt-3 mb-5 whitespace-pre-wrap text-muted">{box.notes}</p>}
      <CredentialTable boxId={box.id} rows={rows} isAdmin={user.role === "ADMIN"} />

      <h2 className="mt-10 mb-3 font-display text-xl">artifacts</h2>
      <Card className="mb-5 p-5">
        <h3 className="mb-3 font-display text-lg">upload to {box.name}</h3>
        <ArtifactUpload boxId={box.id} boxes={[box]} existing={artifacts} />
      </Card>
      <BoxPublicLink boxId={box.id} boxName={box.name} basePath={token && `/d/${token}/`} />
      <ArtifactTable rows={artifacts} boxes={boxes} showBox={false} />
    </>
  );
}
