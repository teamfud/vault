import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileResponse, findPublicArtifact, readArtifact } from "@/lib/artifacts";
import { clientIp, userAgent } from "@/lib/request";
import { isLimited, recordFailure } from "@/lib/rateLimit";

// Public, cookie-free download for boxes: `curl -fsSLO https://vault/d/<box token>/<name>`.
// The token is per box and is the whole capability; <name> picks the file, so
// tools that fetch <url> and then <url>.sig work. Excluded from the proxy matcher.

const MAX_BAD_TOKENS = 30;

const notFound = () =>
  new Response("not found\n", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: RouteContext<"/d/[token]/[name]">) {
  const { token, name } = await ctx.params;
  const limitKey = `public-dl:${(await clientIp()) ?? "unknown"}`;
  if (isLimited(limitKey, MAX_BAD_TOKENS)) {
    return new Response("slow down\n", { status: 429, headers: { "Content-Type": "text/plain", "Retry-After": "900" } });
  }

  // Unknown, private and expired files all look the same from outside. Only
  // bad tokens count toward the throttle, so a box polling for a .sig that
  // isn't there doesn't lock itself out.
  const artifact = await findPublicArtifact(token, name);
  if (artifact === "bad-token") recordFailure(limitKey);
  if (typeof artifact === "string") return notFound();

  const bytes = await readArtifact(artifact.id);
  await db.artifact.update({ where: { id: artifact.id }, data: { publicHits: { increment: 1 } } });
  await audit({
    user: null,
    action: "PUBLIC_DOWNLOAD",
    targetType: "artifact",
    targetId: artifact.id,
    summary: artifact.name,
    meta: { userAgent: await userAgent() },
  });
  return fileResponse(bytes, artifact.name);
}
