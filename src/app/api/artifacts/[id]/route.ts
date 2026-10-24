import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { fileResponse, readArtifact } from "@/lib/artifacts";

export async function GET(_request: Request, ctx: RouteContext<"/api/artifacts/[id]">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const artifact = await db.artifact.findUnique({ where: { id } });
  if (!artifact) notFound();
  const bytes = await readArtifact(id);
  await audit({ user, action: "ARTIFACT_DOWNLOAD", targetType: "artifact", targetId: id, summary: artifact.name });
  return fileResponse(bytes, artifact.name);
}
