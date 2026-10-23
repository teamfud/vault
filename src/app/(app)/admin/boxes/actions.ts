"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/lib/types";

const boxSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(100),
  address: z.string().trim().max(200),
  os: z.string().trim().max(100),
  notes: z.string().trim().max(4000),
});

export async function saveBox(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const parsed = boxSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;
  const clean = { name: data.name, address: data.address || null, os: data.os || null, notes: data.notes || null };

  const clash = await db.box.findFirst({ where: { name: clean.name, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return { error: `A box named “${clean.name}” already exists.` };

  const box = id ? await db.box.update({ where: { id }, data: clean }) : await db.box.create({ data: clean });
  await audit({ user, action: id ? "UPDATE" : "CREATE", targetType: "box", targetId: box.id, summary: box.name });
  revalidatePath("/admin/boxes");
  revalidatePath("/");
  return { ok: id ? "Saved." : `Added ${box.name}.` };
}

export async function deleteBox(id: string) {
  const user = await requireAdmin();
  const box = await db.box.delete({ where: { id } });
  await audit({ user, action: "DELETE", targetType: "box", targetId: id, summary: box.name });
  revalidatePath("/admin/boxes");
  revalidatePath("/");
}
