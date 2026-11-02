"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { RESET_PHRASE, type FormState } from "@/lib/types";

/**
 * Wipe the vault back to a fresh install, keeping users (and their sessions,
 * passwords and 2FA). Boxes take their credentials and history with them;
 * artifacts take their blobs. The audit log is cleared too, then gets one
 * entry recording who did it.
 */
export async function resetVault(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== RESET_PHRASE) {
    return { error: `type “${RESET_PHRASE}” to confirm` };
  }

  const [artifacts, boxes, logs] = await db.$transaction([
    db.artifact.deleteMany(),
    db.box.deleteMany(),
    db.auditLog.deleteMany(),
  ]);

  const summary = `${boxes.count} boxes, ${artifacts.count} artifacts, ${logs.count} audit entries wiped`;
  await audit({ user, action: "RESET", summary });
  revalidatePath("/", "layout");
  return { ok: `done. ${summary}.` };
}
