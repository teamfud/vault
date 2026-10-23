"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { revealSecret } from "@/lib/vault";
import { HashBusyError, yescryptHashAsync } from "@/lib/yescryptPool";

export type HashResult = { hash?: string; error?: string };

// Cost 7 is 64 MiB / ~0.6s per hash. Hashing runs on worker threads, but
// higher costs would still let a few clicks eat the box's memory.
const MAX_COST = 7;

function checkCost(cost: number) {
  return Number.isInteger(cost) && cost >= 1 && cost <= MAX_COST;
}

async function hash(password: string, cost: number): Promise<HashResult> {
  try {
    return { hash: await yescryptHashAsync(password, cost) };
  } catch (e) {
    if (e instanceof HashBusyError) return { error: "the hash machine is busy. try again in a sec" };
    console.error("[vault] yescrypt failed:", (e as Error).message);
    return { error: "hashing broke :( try again" };
  }
}

export async function hashPassword(password: string, cost: number): Promise<HashResult> {
  const user = await requireUser();
  if (!password) return { error: "type a password first" };
  if (password.length > 1000) return { error: "that password is way too long" };
  if (!checkCost(cost)) return { error: `cost must be 1-${MAX_COST}` };
  await audit({ user, action: "HASH", summary: `hash tool (cost ${cost})` });
  return hash(password, cost);
}

/** yescrypt hash of a stored credential's current password, for setting it on the box. */
export async function hashCredential(id: string, cost: number): Promise<HashResult> {
  const user = await requireUser();
  if (!checkCost(cost)) return { error: `cost must be 1-${MAX_COST}` };
  const cred = await db.credential.findUnique({ where: { id }, include: { box: true } });
  if (!cred) return { error: "cred went missing??" };
  // Log before touching the secret, same as revealCredential.
  await audit({
    user,
    action: "HASH",
    targetType: "credential",
    targetId: id,
    summary: `${cred.box.name} / ${cred.service ? `${cred.username} (${cred.service})` : cred.username} (cost ${cost})`,
  });
  let password: string;
  try {
    password = revealSecret(cred);
  } catch {
    return { error: "couldn't decrypt this cred. is VAULT_MASTER_KEY right?" };
  }
  return hash(password, cost);
}
