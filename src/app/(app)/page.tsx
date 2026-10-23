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
      <PageHeader title="boxes" sub="pick a box, any box">
        <form className="w-64">
          <Input name="q" defaultValue={q} placeholder="search box, ip, service, user…" />
        </form>
      </PageHeader>

      {boxes.length === 0 ? (
        <Card className="p-10 text-center text-muted">
          {q ? `no boxes match “${q}” :(` : "no boxes yet. an admin can add some under manage boxes or import :)"}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((box) => (
            <Link key={box.id} href={`/boxes/${box.id}`} className="group">
              <Card className="h-full p-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-[0.6deg] group-hover:bg-accent/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl leading-tight">{box.name}</p>
                    <p className="truncate font-mono text-xs text-muted">{box.address || "—"}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-muted/60 px-2 text-[11px] leading-[18px] text-muted">{box.os || "os ???"}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>
                    <span className="font-display text-base text-fg">{box._count.credentials}</span> cred
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
