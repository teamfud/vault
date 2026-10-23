import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 100;

const ACTIONS = [
  "LOGIN", "LOGIN_FAIL", "LOGOUT", "TOTP_FAIL", "TOTP_ENABLE", "TOTP_DISABLE", "PASSWORD_CHANGE",
  "REVEAL", "COPY", "CREATE", "UPDATE", "ROLLBACK", "DELETE", "IMPORT", "EXPORT",
  "USER_CREATE", "USER_UPDATE", "USER_RESET_PASSWORD", "USER_RESET_TOTP",
];

function tone(action: string) {
  if (action.endsWith("FAIL") || action === "DELETE") return "danger" as const;
  if (action === "REVEAL" || action === "COPY" || action === "EXPORT") return "warn" as const;
  if (["CREATE", "UPDATE", "ROLLBACK", "IMPORT"].includes(action)) return "accent" as const;
  return "neutral" as const;
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action : "";
  const user = typeof sp.user === "string" ? sp.user.trim() : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(action && { action }),
    ...(user && { username: { contains: user, mode: "insensitive" } }),
    ...(q && {
      OR: [{ summary: { contains: q, mode: "insensitive" } }, { ip: { contains: q } }, { targetId: q }],
    }),
  };
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { at: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `?${new URLSearchParams({ action, user, q, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Audit log">
        <span className="text-sm text-muted">{total} entries</span>
      </PageHeader>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Select name="action" defaultValue={action} className="w-48">
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Input name="user" defaultValue={user} placeholder="User" className="w-40" />
        <Input name="q" defaultValue={q} placeholder="Box, account, IP…" className="w-56" />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(action || user || q) && (
          <Link href="/admin/audit" className="px-2 text-sm text-muted hover:text-fg">
            Clear
          </Link>
        )}
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
              <th className="px-4 py-2.5 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No entries.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted">
                  {e.at.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.username ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={tone(e.action)}>{e.action}</Badge>
                </td>
                <td className="px-4 py-2 text-xs">{e.summary ?? ""}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{e.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={link(page - 1)} className="text-accent">← Newer</Link>}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && <Link href={link(page + 1)} className="text-accent">Older →</Link>}
        </div>
      )}
    </>
  );
}
