"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { parseCsv, type CsvRow } from "@/lib/csv";
import { createCredential, revealSecret, rotateCredential } from "@/lib/vault";

export type PlanRow = {
  line: number;
  box: string;
  username: string;
  service: string;
  action: "create" | "rotate" | "unchanged";
  newBox: boolean;
};

export type ImportResult = { errors: string[]; plan: PlanRow[]; committed?: boolean };

const MAX_BYTES = 2_000_000;

async function plan(rows: CsvRow[]): Promise<{ plan: PlanRow[]; errors: string[] }> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const boxes = new Map((await db.box.findMany({ include: { credentials: true } })).map((b) => [b.name, b]));
  const out: PlanRow[] = [];
  for (const r of rows) {
    const key = `${r.box}\u0000${r.service}\u0000${r.username}`;
    if (seen.has(key)) {
      errors.push(`line ${r.line}: duplicate of an earlier row (${r.box} / ${r.username} / ${r.service || "no service"})`);
      continue;
    }
    seen.add(key);
    const box = boxes.get(r.box);
    const existing = box?.credentials.find((c) => c.username === r.username && c.service === r.service);
    out.push({
      line: r.line,
      box: r.box,
      username: r.username,
      service: r.service,
      newBox: !box,
      action: !existing ? "create" : revealSecret(existing) === r.password ? "unchanged" : "rotate",
    });
  }
  return { plan: out, errors };
}

export async function previewImport(text: string): Promise<ImportResult> {
  await requireAdmin();
  if (text.length > MAX_BYTES) return { errors: ["file too big (2 mb max)"], plan: [] };
  const { rows, errors } = parseCsv(text);
  if (errors.length) return { errors, plan: [] };
  return plan(rows);
}

export async function commitImport(text: string): Promise<ImportResult> {
  const user = await requireAdmin();
  if (text.length > MAX_BYTES) return { errors: ["file too big (2 mb max)"], plan: [] };
  const { rows, errors: parseErrors } = parseCsv(text);
  if (parseErrors.length) return { errors: parseErrors, plan: [] };
  const { plan: steps, errors } = await plan(rows);
  if (errors.length) return { errors, plan: steps };

  const byLine = new Map(rows.map((r) => [r.line, r]));
  for (const step of steps) {
    const r = byLine.get(step.line)!;
    const box = await db.box.upsert({
      where: { name: r.box },
      create: { name: r.box, address: r.address || null, os: r.os || null },
      // Only fill blanks; don't clobber details an admin edited by hand.
      update: {},
    });
    if (!box.address && r.address) await db.box.update({ where: { id: box.id }, data: { address: r.address } });
    if (!box.os && r.os) await db.box.update({ where: { id: box.id }, data: { os: r.os } });

    if (step.action === "create") {
      await createCredential({ boxId: box.id, ...r, notes: r.notes || null }, user.id);
    } else if (step.action === "rotate") {
      const cred = await db.credential.findUniqueOrThrow({
        where: { boxId_service_username: { boxId: box.id, service: r.service, username: r.username } },
      });
      await rotateCredential(cred.id, r.password, user.id);
    }
  }

  const count = (a: PlanRow["action"]) => steps.filter((s) => s.action === a).length;
  await audit({
    user,
    action: "IMPORT",
    summary: `${count("create")} created, ${count("rotate")} rotated, ${count("unchanged")} unchanged`,
  });
  revalidatePath("/", "layout");
  return { errors: [], plan: steps, committed: true };
}
