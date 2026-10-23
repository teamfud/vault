import "server-only";
import { headers } from "next/headers";

/** Client IP as seen through Railway's proxy. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
