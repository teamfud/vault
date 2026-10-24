import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { db } from "./db";
import { clientIp, userAgent } from "./request";

const COOKIE = "vault_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 12;

export type CurrentUser = {
  id: string;
  username: string;
  role: "ADMIN" | "MEMBER";
  mustChangePassword: boolean;
  totpEnabled: boolean;
};

export function hashPassword(password: string) {
  return hash(password);
}

// Verified against when the username doesn't exist, so a miss costs the same as a hit.
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    dummyHash ??= hash(randomBytes(16).toString("hex"));
    await verify(await dummyHash, password);
    return false;
  }
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

function tokenId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, verified: boolean) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: tokenId(token), userId, verified, expiresAt, ip: await clientIp(), userAgent: await userAgent() },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: tokenId(token) } });
  jar.delete(COOKIE);
}

/** Session + user for this request, or null. Deduplicated per request. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: tokenId(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.disabled) return null;
  const { user } = session;
  return {
    id: session.id,
    verified: session.verified,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      totpEnabled: !!user.totpSecret,
    } satisfies CurrentUser,
  };
});

/**
 * The logged-in user, or a redirect. Pages and server actions must call this
 * (or requireAdmin) themselves; the proxy check is only a convenience.
 */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.verified) redirect("/login/totp");
  if (session.user.mustChangePassword && !opts.allowPasswordChange) redirect("/account?required=1");
  return session.user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/**
 * Like requireUser, but for route handlers that should answer with a status
 * code instead of a redirect. Null means 401.
 */
export async function apiUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session?.verified || session.user.mustChangePassword) return null;
  return session.user;
}

export async function markSessionVerified(sessionId: string) {
  await db.session.update({ where: { id: sessionId }, data: { verified: true } });
}

/** Kill every session for a user except, optionally, the current one. */
export async function revokeSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
