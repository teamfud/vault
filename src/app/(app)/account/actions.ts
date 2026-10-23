"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  getSession,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  requireUser,
  revokeSessions,
  verifyPassword,
} from "@/lib/auth";
import { checkCode, newTotpSecret, sealTotpSecret, totpUri, verifyUserTotp } from "@/lib/totp";
import type { FormState } from "@/lib/types";

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (next.length < MIN_PASSWORD_LENGTH) return { error: `new password needs ${MIN_PASSWORD_LENGTH}+ characters` };
  if (next !== confirm) return { error: "those passwords don't match" };
  if (next === current) return { error: "new password can't be the same as the old one, silly" };

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, current))) return { error: "current password is wrong" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  const session = await getSession();
  await revokeSessions(user.id, session?.id);
  await audit({ user, action: "PASSWORD_CHANGE", targetType: "user", targetId: user.id });
  if (user.mustChangePassword) redirect("/");
  return { ok: "password changed. other sessions got kicked out" };
}

export async function beginTotp(): Promise<{ secret: string; qr: string }> {
  const user = await requireUser({ allowPasswordChange: true });
  const secret = newTotpSecret();
  const qr = await QRCode.toDataURL(totpUri(user.username, secret), { margin: 1, width: 200 });
  return { secret, qr };
}

export async function confirmTotp(secret: string, code: string): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const step = await checkCode(secret, code).catch(() => null);
  if (step == null) return { error: "code didn't match. check ur device clock and try again" };
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: sealTotpSecret(user.id, secret), totpLastStep: step },
  });
  await audit({ user, action: "TOTP_ENABLE", targetType: "user", targetId: user.id });
  revalidatePath("/account");
  return { ok: "2fa on. extra secure now B)" };
}

export async function disableTotp(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  if (!(await verifyUserTotp(user.id, String(form.get("code") ?? "")))) return { error: "wrong code" };
  await db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpLastStep: null } });
  await audit({ user, action: "TOTP_DISABLE", targetType: "user", targetId: user.id });
  revalidatePath("/account");
  return { ok: "2fa off" };
}
