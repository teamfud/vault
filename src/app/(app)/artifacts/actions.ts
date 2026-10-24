"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { ensureBoxToken, findSameName, rotateBoxToken } from "@/lib/artifacts";
import { EXPIRY_OPTIONS, type Expiry } from "@/lib/expiry";
import type { FormState } from "@/lib/types";

// Everyone, members included, can publish and delete artifacts.

function revalidate(...boxIds: (string | null)[]) {
  revalidatePath("/artifacts");
  for (const id of boxIds) if (id) revalidatePath(`/boxes/${id}`);
}

export async function setArtifactPublic(id: string, expiry: Expiry): Promise<FormState> {
  const user = await requireUser();
  if (!Object.hasOwn(EXPIRY_OPTIONS, expiry)) return { error: "bad expiry" };
  const artifact = await db.artifact.findUnique({ where: { id }, include: { box: true } });
  if (!artifact) return { error: "artifact went missing??" };
  if (!artifact.box) return { error: "public links live under a box. attach it to one first (edit)" };

  const hours = EXPIRY_OPTIONS[expiry];
  await ensureBoxToken(artifact.box.id);
  await db.artifact.update({
    where: { id },
    data: { public: true, publicExpiresAt: hours === null ? null : new Date(Date.now() + hours * 3600_000) },
  });
  await audit({
    user,
    action: "ARTIFACT_PUBLISH",
    targetType: "artifact",
    targetId: id,
    summary: `${artifact.box.name} / ${artifact.name} — ${hours === null ? "no expiry" : `expires in ${expiry}`}`,
  });
  revalidate(artifact.boxId);
  return { ok: "public :)" };
}

export async function unpublishArtifact(id: string) {
  const user = await requireUser();
  const artifact = await db.artifact.update({ where: { id }, data: { public: false, publicExpiresAt: null } });
  await audit({ user, action: "ARTIFACT_UNPUBLISH", targetType: "artifact", targetId: id, summary: artifact.name });
  revalidate(artifact.boxId);
}

/** New public token for a box: every public URL on it changes at once. */
export async function rotateBoxLink(boxId: string) {
  const user = await requireUser();
  const box = await rotateBoxToken(boxId);
  await audit({ user, action: "ARTIFACT_LINK_ROTATE", targetType: "box", targetId: boxId, summary: box.name });
  revalidate(boxId);
}

const editSchema = z.object({
  id: z.string().min(1),
  boxId: z.string().max(100),
  notes: z.string().trim().max(2000),
});

export async function updateArtifact(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, boxId, notes } = parsed.data;

  const before = await db.artifact.findUnique({ where: { id } });
  if (!before) return { error: "artifact went missing??" };
  const box = boxId ? await db.box.findUnique({ where: { id: boxId } }) : null;
  if (boxId && !box) return { error: "box went missing??" };

  const moved = (box?.id ?? null) !== before.boxId;
  if (moved) {
    const clash = await findSameName(box?.id ?? null, before.name);
    if (clash) return { error: `${box?.name ?? "the no-box pile"} already has a file named ${before.name}` };
    if (before.public && box) await ensureBoxToken(box.id);
  }

  await db.artifact.update({
    where: { id },
    data: {
      boxId: box?.id ?? null,
      notes: notes || null,
      // Boxless files can't have a public URL.
      ...(!box && { public: false, publicExpiresAt: null }),
    },
  });
  await audit({
    user,
    action: "UPDATE",
    targetType: "artifact",
    targetId: id,
    summary: `${before.name}${box ? ` on ${box.name}` : " (no box)"}${moved && before.public ? " — public url changed" : ""}`,
  });
  revalidate(before.boxId, box?.id ?? null);
  return { ok: "saved" };
}

export async function deleteArtifact(id: string) {
  const user = await requireUser();
  const artifact = await db.artifact.delete({ where: { id } });
  await audit({ user, action: "ARTIFACT_DELETE", targetType: "artifact", targetId: id, summary: artifact.name });
  revalidate(artifact.boxId);
}
