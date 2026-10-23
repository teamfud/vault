"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, requireAdmin, revokeSessions } from "@/lib/auth";
import { generatePassword } from "@/lib/generate";

export type UserActionState = { error?: string; ok?: string; tempPassword?: string } | null;

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username is too short")
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, digits, dot, dash or underscore"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function createUser(_: UserActionState, form: FormData): Promise<UserActionState> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await db.user.findUnique({ where: { username: parsed.data.username } })) return { error: "Username already exists." };

  const tempPassword = generatePassword("shell-safe", 16);
  const user = await db.user.create({
    data: { ...parsed.data, passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  await audit({ user: admin, action: "USER_CREATE", targetType: "user", targetId: user.id, summary: `${user.username} (${user.role})` });
  revalidatePath("/admin/users");
  return { ok: `Created ${user.username}.`, tempPassword };
}

async function target(id: string, adminId: string) {
  if (id === adminId) throw new Error("You can't change your own account here.");
  return db.user.findUniqueOrThrow({ where: { id } });
}

export async function resetPassword(id: string): Promise<string> {
  const admin = await requireAdmin();
  const user = await target(id, admin.id);
  const tempPassword = generatePassword("shell-safe", 16);
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true } });
  await revokeSessions(id);
  await audit({ user: admin, action: "USER_RESET_PASSWORD", targetType: "user", targetId: id, summary: user.username });
  revalidatePath("/admin/users");
  return tempPassword;
}

export async function setDisabled(id: string, disabled: boolean) {
  const admin = await requireAdmin();
  const user = await target(id, admin.id);
  await db.user.update({ where: { id }, data: { disabled } });
  if (disabled) await revokeSessions(id);
  await audit({
    user: admin,
    action: "USER_UPDATE",
    targetType: "user",
    targetId: id,
    summary: `${user.username} ${disabled ? "disabled" : "enabled"}`,
  });
  revalidatePath("/admin/users");
}

export async function setRole(id: string, role: "ADMIN" | "MEMBER") {
  const admin = await requireAdmin();
  const user = await target(id, admin.id);
  await db.user.update({ where: { id }, data: { role: role === "ADMIN" ? "ADMIN" : "MEMBER" } });
  await audit({ user: admin, action: "USER_UPDATE", targetType: "user", targetId: id, summary: `${user.username} role → ${role}` });
  revalidatePath("/admin/users");
}

export async function resetTotp(id: string) {
  const admin = await requireAdmin();
  const user = await target(id, admin.id);
  await db.user.update({ where: { id }, data: { totpSecret: null, totpLastStep: null } });
  await audit({ user: admin, action: "USER_RESET_TOTP", targetType: "user", targetId: id, summary: user.username });
  revalidatePath("/admin/users");
}
