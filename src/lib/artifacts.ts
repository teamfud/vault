import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import { decrypt, decryptBytes, encrypt, encryptBytes } from "./crypto";
import { contentDisposition, safeFilename } from "./filename";
import { Prisma } from "@/generated/prisma/client";

export const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;

const blobAad = (id: string) => `artifact:${id}`;
const boxTokenAad = (boxId: string) => `box-token:${boxId}`;
const fileTokenAad = (id: string) => `artifact-token:${id}`;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Same box (or both boxless) and same name: the one an upload would replace. */
export function findSameName(boxId: string | null, name: string) {
  return db.artifact.findFirst({ where: { boxId, name } });
}

export type StoreResult =
  | { status: "created"; artifact: Prisma.ArtifactGetPayload<object> }
  | { status: "replaced"; artifact: Prisma.ArtifactGetPayload<object>; previousSha256: string }
  | { status: "conflict"; name: string };

/**
 * Save an upload. A same-named file on the same box is only overwritten when
 * `replace` is set (the user confirmed); it keeps its id, and so its public
 * URL, visibility and expiry.
 */
export async function storeArtifact(
  input: { file: File; boxId: string | null; notes: string | null; replace: boolean },
  userId: string,
): Promise<StoreResult> {
  const name = safeFilename(input.file.name);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const fields = {
    contentType: input.file.type.slice(0, 200) || "application/octet-stream",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    uploadedById: userId,
  };
  // Prisma wants an ArrayBuffer-backed Uint8Array, not a pooled Buffer.
  const sealed = (id: string) => new Uint8Array(encryptBytes(bytes, blobAad(id)));

  const existing = await findSameName(input.boxId, name);
  if (existing) {
    if (!input.replace) return { status: "conflict", name };
    const artifact = await db.artifact.update({
      where: { id: existing.id },
      data: {
        ...fields,
        createdAt: new Date(),
        ...(input.notes && { notes: input.notes }),
        blob: { update: { data: sealed(existing.id) } },
      },
    });
    return { status: "replaced", artifact, previousSha256: existing.sha256 };
  }

  const id = randomUUID();
  try {
    const artifact = await db.artifact.create({
      data: { id, name, ...fields, notes: input.notes, boxId: input.boxId, blob: { create: { data: sealed(id) } } },
    });
    return { status: "created", artifact };
  } catch (e) {
    // Someone uploaded the same name to this box in the meantime.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: "conflict", name };
    throw e;
  }
}

export async function readArtifact(id: string): Promise<Buffer> {
  const blob = await db.artifactBlob.findUniqueOrThrow({ where: { artifactId: id } });
  return decryptBytes(Buffer.from(blob.data), blobAad(id));
}

function newToken(aad: string) {
  const token = randomBytes(32).toString("base64url");
  return { publicTokenHash: tokenHash(token), publicToken: encrypt(token, aad) };
}
const newBoxToken = (boxId: string) => newToken(boxTokenAad(boxId));

/** Columns giving a boxless file its own fresh link token; any old link dies. */
export const newFileToken = (id: string) => newToken(fileTokenAad(id));
export const noFileToken = { publicTokenHash: null, publicToken: null };

/** Give the box a public link token if it doesn't have one yet. */
export async function ensureBoxToken(boxId: string) {
  await db.box.updateMany({ where: { id: boxId, publicToken: null }, data: newBoxToken(boxId) });
}

/** New token for the box: every public URL on it changes and the old ones die. */
export async function rotateBoxToken(boxId: string) {
  return db.box.update({ where: { id: boxId }, data: newBoxToken(boxId) });
}

export function boxToken(box: { id: string; publicToken: string | null }): string | null {
  return box.publicToken ? decrypt(box.publicToken, boxTokenAad(box.id)) : null;
}

function fileToken(a: { id: string; publicToken: string | null }): string | null {
  return a.publicToken ? decrypt(a.publicToken, fileTokenAad(a.id)) : null;
}

export function publicPath(token: string, name: string) {
  return `/d/${token}/${encodeURIComponent(name)}`;
}

/**
 * Resolve /d/<token>/<name>, where the token is a box's or a boxless file's
 * own. "bad-token" (neither) is what a guesser hits and gets throttled;
 * "missing" is a real link asking for a file that isn't there or isn't
 * public, e.g. a tool probing for an optional .sig.
 */
export async function findPublicArtifact(token: string, name: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return "bad-token" as const;
  const hash = tokenHash(token);
  // Accept the segment whether or not the router already URL-decoded it.
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {}

  let a;
  const box = await db.box.findUnique({ where: { publicTokenHash: hash }, select: { id: true } });
  if (box) {
    a =
      (await db.artifact.findUnique({ where: { boxId_name: { boxId: box.id, name } } })) ??
      (decoded !== name ? await db.artifact.findUnique({ where: { boxId_name: { boxId: box.id, name: decoded } } }) : null);
  } else {
    a = await db.artifact.findUnique({ where: { publicTokenHash: hash } });
    if (!a) return "bad-token" as const;
    // The token picks the file; the name has to match too, so it can't be swapped for anything.
    if (a.boxId || (a.name !== name && a.name !== decoded)) return "missing" as const;
  }
  if (!a?.public || (a.publicExpiresAt && a.publicExpiresAt <= new Date())) return "missing" as const;
  return a;
}

/**
 * Always a download, never rendered: an uploaded .html or .svg served inline
 * from the vault origin would be stored XSS against everyone logged in. The
 * sandbox CSP for these routes is set in next.config.ts.
 */
export function fileResponse(bytes: Buffer, name: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": contentDisposition(name),
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export type ArtifactRow = {
  id: string;
  name: string;
  size: number;
  sha256: string;
  notes: string | null;
  boxId: string | null;
  boxName: string | null;
  uploadedBy: string | null;
  createdAt: string;
  // Only set while public; tokens never reach the client otherwise.
  publicPath: string | null;
  publicExpiresAt: string | null;
  publicHits: number;
};

export async function listArtifacts(where: { boxId?: string } = {}): Promise<ArtifactRow[]> {
  const rows = await db.artifact.findMany({
    where,
    orderBy: [{ boxId: "asc" }, { name: "asc" }],
    include: {
      box: { select: { id: true, name: true, publicToken: true } },
      uploadedBy: { select: { username: true } },
    },
  });
  return rows.map((a) => {
    // A box deletion leaves `public` set on a now boxless artifact with no token of its own; it has no URL.
    const token = !a.public ? null : a.box ? boxToken(a.box) : fileToken(a);
    return {
      id: a.id,
      name: a.name,
      size: a.size,
      sha256: a.sha256,
      notes: a.notes,
      boxId: a.boxId,
      boxName: a.box?.name ?? null,
      uploadedBy: a.uploadedBy?.username ?? null,
      createdAt: a.createdAt.toISOString(),
      publicPath: token ? publicPath(token, a.name) : null,
      publicExpiresAt: a.publicExpiresAt?.toISOString() ?? null,
      publicHits: a.publicHits,
    };
  });
}
