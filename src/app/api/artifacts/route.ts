import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { apiUser } from "@/lib/auth";
import { MAX_ARTIFACT_BYTES, storeArtifact } from "@/lib/artifacts";
import { formatBytes } from "@/lib/filename";

// Upload lives in a route handler, not a server action: actions cap bodies at
// 1MB. It's also excluded from the proxy matcher, which would otherwise
// silently truncate anything over 10MB (proxyClientMaxBodySize).

const fieldsSchema = z.object({
  boxId: z.string().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  replace: z.literal("1").optional(),
});

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Belt and braces on top of the SameSite=Strict session cookie. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const user = await apiUser();
  if (!user) return fail(401, "log in first");
  if (!sameOrigin(request)) return fail(403, "bad origin");

  // Content-Length covers the multipart overhead too, so allow a little slack.
  const length = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(length) || length > MAX_ARTIFACT_BYTES + 64 * 1024) {
    return fail(413, `too chonky. max ${formatBytes(MAX_ARTIFACT_BYTES)}`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "couldn't read that upload");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, "pick a file pls");
  if (file.size > MAX_ARTIFACT_BYTES) return fail(413, `too chonky. max ${formatBytes(MAX_ARTIFACT_BYTES)}`);
  const fields = fieldsSchema.safeParse({
    boxId: form.get("boxId") || undefined,
    notes: form.get("notes") || undefined,
    replace: form.get("replace") || undefined,
  });
  if (!fields.success) return fail(400, fields.error.issues[0].message);

  const boxId = fields.data.boxId ?? null;
  const box = boxId ? await db.box.findUnique({ where: { id: boxId } }) : null;
  if (boxId && !box) return fail(400, "box went missing??");

  const result = await storeArtifact(
    { file, boxId, notes: fields.data.notes || null, replace: fields.data.replace === "1" },
    user.id,
  );
  // The client asks the user, then retries with replace=1.
  if (result.status === "conflict") {
    return Response.json({ error: `${result.name} already exists${box ? ` on ${box.name}` : ""}`, conflict: result.name }, { status: 409 });
  }

  const { artifact } = result;
  const where = box ? ` on ${box.name}` : "";
  await audit({
    user,
    action: result.status === "replaced" ? "ARTIFACT_REPLACE" : "ARTIFACT_UPLOAD",
    targetType: "artifact",
    targetId: artifact.id,
    summary: `${artifact.name} (${formatBytes(artifact.size)})${where}`,
    meta:
      result.status === "replaced"
        ? { sha256: artifact.sha256, previousSha256: result.previousSha256 }
        : { sha256: artifact.sha256 },
  });
  return Response.json({ id: artifact.id, name: artifact.name, replaced: result.status === "replaced" });
}
