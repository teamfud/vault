import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Input, PageHeader, timeAgo } from "@/components/ui";

export default async function BoxesPage({ searchParams }: PageProps<"/">) {
  await requireUser();
  const q = String((await searchParams).q ?? "").trim();

  const boxes = await db.box.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { os: { contains: q, mode: "insensitive" } },
            { credentials: { some: { service: { contains: q, mode: "insensitive" } } } },
            { credentials: { some: { username: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { credentials: true } },
      credentials: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  return (
    <>
      <PageHeader title="Boxes">
        <form className="w-64">
          <Input name="q" defaultValue={q} placeholder="Search box, IP, service, user…" />
        </form>
      </PageHeader>

      {boxes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">
          {q ? `No boxes match “${q}”.` : "No boxes yet. An admin can add them under Manage boxes or Import."}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((box) => (
            <Link key={box.id} href={`/boxes/${box.id}`} className="group">
              <Card className="h-full p-4 transition group-hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{box.name}</p>
                    <p className="truncate font-mono text-xs text-muted">{box.address || "—"}</p>
                  </div>
                  <span className="shrink-0 rounded bg-panel-2 px-2 py-0.5 text-xs text-muted">{box.os || "?"}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>
                    <span className="font-semibold text-fg">{box._count.credentials}</span> credential
                    {box._count.credentials === 1 ? "" : "s"}
                  </span>
                  {box.credentials[0] && <span>updated {timeAgo(box.credentials[0].updatedAt)}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
