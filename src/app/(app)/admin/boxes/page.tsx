import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { BoxesClient } from "./BoxesClient";

export default async function ManageBoxesPage() {
  await requireAdmin();
  const boxes = await db.box.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { credentials: true } } } });
  return (
    <>
      <PageHeader title="manage boxes" sub="the stuff we're defending" />
      <BoxesClient
        boxes={boxes.map((b) => ({ id: b.id, name: b.name, address: b.address, os: b.os, notes: b.notes, count: b._count.credentials }))}
      />
    </>
  );
}
