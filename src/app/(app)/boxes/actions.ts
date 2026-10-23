"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createCredential, revealHistory, revealSecret, rollbackCredential, rotateCredential } from "@/lib/vault";
import type { FormState } from "@/lib/types";

const label = (c: { username: string; service: string }) => (c.service ? `${c.username} (${c.service})` : c.username);

/** Return a plaintext secret. `mode` only changes how the access is logged. */
export async function revealCredential(id: string, mode: "reveal" | "copy"): Promise<string> {
  const user = await requireUser();
  const cred = await db.credential.findUniqueOrThrow({ where: { id }, include: { box: true } });
  await audit({
    user,
    action: mode === "copy" ? "COPY" : "REVEAL",
    targetType: "credential",
    targetId: id,
    summary: `${cred.box.name} / ${label(cred)}`,
  });
  return revealSecret(cred);
}

const credentialSchema = z.object({
  boxId: z.string().min(1),
  kind: z.enum(["USER", "SERVICE"]),
  service: z.string().trim().max(100),
  username: z.string().trim().min(1, "username pls").max(200),
  password: z.string().min(1, "password pls").max(1000),
  notes: z.string().trim().max(2000).optional(),
});

export async function addCredential(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = credentialSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const box = await db.box.findUnique({ where: { id: parsed.data.boxId } });
  if (!box) return { error: "box went missing??" };
  const exists = await db.credential.findFirst({
    where: { boxId: box.id, service: parsed.data.service, username: parsed.data.username },
  });
  if (exists) return { error: "that username/service already exists on this box. rotate it instead" };

  const cred = await createCredential(parsed.data, user.id);
  await audit({ user, action: "CREATE", targetType: "credential", targetId: cred.id, summary: `${box.name} / ${label(cred)}` });
  revalidatePath(`/boxes/${box.id}`);
  return { ok: "cred added :)" };
}

const editSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["USER", "SERVICE"]),
  service: z.string().trim().max(100),
  username: z.string().trim().min(1, "username pls").max(200),
  password: z.string().max(1000),
  notes: z.string().trim().max(2000).optional(),
});

/** Update metadata and, when a new password is supplied, rotate the secret. */
export async function updateCredential(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, password, ...meta } = parsed.data;

  const cred = await db.credential.findUnique({ where: { id }, include: { box: true } });
  if (!cred) return { error: "cred went missing??" };

  const clash = await db.credential.findFirst({
    where: { boxId: cred.boxId, service: meta.service, username: meta.username, id: { not: id } },
  });
  if (clash) return { error: "another cred on this box already uses that username/service" };

  // Rotate before touching metadata so the history row keeps the previous editor.
  const rotated = password.length > 0 && password !== revealSecret(cred);
  if (rotated) await rotateCredential(id, password, user.id);
  await db.credential.update({
    where: { id },
    data: { ...meta, notes: meta.notes || null, updatedById: user.id },
  });

  await audit({
    user,
    action: "UPDATE",
    targetType: "credential",
    targetId: id,
    summary: `${cred.box.name} / ${label(meta)}${rotated ? " — password rotated" : ""}`,
  });
  revalidatePath(`/boxes/${cred.boxId}`);
  return { ok: rotated ? "password rotated. take that, red team" : "saved" };
}

export async function deleteCredential(id: string) {
  const user = await requireAdmin();
  const cred = await db.credential.delete({ where: { id }, include: { box: true } });
  await audit({ user, action: "DELETE", targetType: "credential", targetId: id, summary: `${cred.box.name} / ${label(cred)}` });
  revalidatePath(`/boxes/${cred.boxId}`);
}

export type HistoryRow = { id: string; version: number; changedBy: string | null; changedAt: string };

export async function getHistory(credentialId: string): Promise<HistoryRow[]> {
  await requireUser();
  const rows = await db.credentialHistory.findMany({
    where: { credentialId },
    orderBy: { version: "desc" },
    include: { changedBy: { select: { username: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    changedBy: r.changedBy?.username ?? null,
    changedAt: r.changedAt.toISOString(),
  }));
}

export async function revealHistoryEntry(historyId: string): Promise<string> {
  const user = await requireUser();
  const entry = await db.credentialHistory.findUniqueOrThrow({
    where: { id: historyId },
    include: { credential: { include: { box: true } } },
  });
  await audit({
    user,
    action: "REVEAL",
    targetType: "credential",
    targetId: entry.credentialId,
    summary: `${entry.credential.box.name} / ${label(entry.credential)} — history v${entry.version}`,
  });
  return revealHistory(entry);
}

export async function rollback(historyId: string) {
  const user = await requireUser();
  const { updated, fromVersion } = await rollbackCredential(historyId, user.id);
  const box = await db.box.findUniqueOrThrow({ where: { id: updated.boxId } });
  await audit({
    user,
    action: "ROLLBACK",
    targetType: "credential",
    targetId: updated.id,
    summary: `${box.name} / ${label(updated)} — restored v${fromVersion} as v${updated.version}`,
  });
  revalidatePath(`/boxes/${updated.boxId}`);
}
