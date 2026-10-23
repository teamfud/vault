import "server-only";
import { generateSecret, generateURI, verify } from "otplib";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { BRAND } from "./brand";

const aad = (userId: string) => `totp:${userId}`;

export function newTotpSecret() {
  return generateSecret();
}

export function totpUri(username: string, secret: string) {
  return generateURI({ issuer: BRAND.name, label: username, secret });
}

export function sealTotpSecret(userId: string, secret: string) {
  return encrypt(secret, aad(userId));
}

/** Check a code against a raw secret; returns the matched time step, or null if wrong or malformed. */
export async function checkCode(secret: string, token: string, afterTimeStep?: number) {
  token = token.replace(/\s/g, "");
  // otplib throws (rather than returning invalid) on anything but 6 digits.
  if (!/^\d{6}$/.test(token)) return null;
  const result = await verify({
    secret,
    token,
    epochTolerance: 30,
    ...(afterTimeStep != null ? { afterTimeStep } : {}),
  });
  return result.valid && "timeStep" in result ? result.timeStep : null;
}

/** Verify a user's code and record the time step so it can't be replayed. */
export async function verifyUserTotp(userId: string, token: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) return false;
  const step = await checkCode(decrypt(user.totpSecret, aad(userId)), token, user.totpLastStep ?? undefined);
  if (step == null) return false;
  await db.user.update({ where: { id: userId }, data: { totpLastStep: step } });
  return true;
}
