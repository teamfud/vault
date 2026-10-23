import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { CredentialKind } from "@/generated/prisma/client";

// Secrets are bound to their credential id via AAD; history rows reuse it so
// any past version can be decrypted and restored onto the same credential.
const aad = (credentialId: string) => `cred:${credentialId}`;

export function revealSecret(cred: { id: string; secret: string }) {
  return decrypt(cred.secret, aad(cred.id));
}

export type CredentialInput = {
  boxId: string;
  kind: CredentialKind;
  service: string;
  username: string;
  password: string;
  notes?: string | null;
};

export async function createCredential(input: CredentialInput, userId: string) {
  const id = randomUUID();
  return db.credential.create({
    data: {
      id,
      boxId: input.boxId,
      kind: input.kind,
      service: input.service,
      username: input.username,
      notes: input.notes || null,
      secret: encrypt(input.password, aad(id)),
      updatedById: userId,
    },
  });
}

/** Store a new secret, pushing the current one into history. */
export async function rotateCredential(credentialId: string, password: string, userId: string) {
  return db.$transaction(async (tx) => {
    const cred = await tx.credential.findUniqueOrThrow({ where: { id: credentialId } });
    await tx.credentialHistory.create({
      data: {
        credentialId,
        secret: cred.secret,
        version: cred.version,
        changedById: cred.updatedById,
        changedAt: cred.updatedAt,
      },
    });
    return tx.credential.update({
      where: { id: credentialId },
      data: { secret: encrypt(password, aad(credentialId)), version: cred.version + 1, updatedById: userId },
    });
  });
}

export async function rollbackCredential(historyId: string, userId: string) {
  const entry = await db.credentialHistory.findUniqueOrThrow({ where: { id: historyId } });
  const password = decrypt(entry.secret, aad(entry.credentialId));
  const updated = await rotateCredential(entry.credentialId, password, userId);
  return { updated, fromVersion: entry.version };
}

export function revealHistory(entry: { credentialId: string; secret: string }) {
  return decrypt(entry.secret, aad(entry.credentialId));
}
