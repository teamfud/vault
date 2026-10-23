import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
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
    </>
  );
}
