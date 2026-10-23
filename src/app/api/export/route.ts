import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { revealSecret } from "@/lib/vault";

export async function GET() {
  const user = await requireAdmin();
  const creds = await db.credential.findMany({
    include: { box: true },
    orderBy: [{ box: { name: "asc" } }, { service: "asc" }, { username: "asc" }],
  });
  const csv = toCsv(
    creds.map((c) => ({
      box: c.box.name,
      address: c.box.address ?? "",
      os: c.box.os ?? "",
      kind: c.kind,
      service: c.service,
      username: c.username,
      password: revealSecret(c),
      notes: c.notes ?? "",
    })),
  );
  await audit({ user, action: "EXPORT", summary: `${creds.length} credentials` });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vault-export-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
