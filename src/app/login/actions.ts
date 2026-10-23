"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getSession, markSessionVerified, verifyPassword } from "@/lib/auth";
import { clearFailures, isLimited, recordFailure } from "@/lib/rateLimit";
import { clientIp } from "@/lib/request";
import { verifyUserTotp } from "@/lib/totp";
import type { FormState } from "@/lib/types";

const GENERIC_ERROR = "nope. wrong username or password :(";

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  const ipKey = `ip:${ip}`;
  // Keyed by IP as well so the red team can't lock blue members out by
  // spamming bad passwords for their usernames.
  const userKey = `user:${ip}:${username.toLowerCase()}`;

  if (isLimited(ipKey, 30) || isLimited(userKey, 10)) {
    return { error: "whoa, slow down. too many tries. come back in a few min" };
  }

  const user = username ? await db.user.findUnique({ where: { username } }) : null;
  const ok = await verifyPassword(user?.passwordHash ?? null, password);

  if (!user || !ok || user.disabled) {
    recordFailure(ipKey);
    recordFailure(userKey);
    await audit({ user: null, username, action: "LOGIN_FAIL", summary: user?.disabled ? "account disabled" : undefined });
    return { error: GENERIC_ERROR };
  }

  clearFailures(userKey);
  const needsTotp = !!user.totpSecret;
  await createSession(user.id, !needsTotp);
  if (needsTotp) redirect("/login/totp");

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ user, action: "LOGIN" });
  redirect(user.mustChangePassword ? "/account?required=1" : "/");
}

export async function verifyTotp(_: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.verified) redirect("/");

  const key = `totp:${session.user.id}`;
  if (isLimited(key, 5)) {
    await destroySession();
    redirect("/login");
  }

  const code = String(form.get("code") ?? "");
  if (!(await verifyUserTotp(session.user.id, code))) {
    recordFailure(key);
    await audit({ user: session.user, action: "TOTP_FAIL" });
    return { error: "wrong code. try again" };
  }

  clearFailures(key);
  await markSessionVerified(session.id);
  await db.user.update({ where: { id: session.user.id }, data: { lastLoginAt: new Date() } });
  await audit({ user: session.user, action: "LOGIN", summary: "with 2fa" });
  redirect(session.user.mustChangePassword ? "/account?required=1" : "/");
}

export async function logout() {
  const session = await getSession();
  if (session) await audit({ user: session.user, action: "LOGOUT" });
  await destroySession();
  redirect("/login");
}
