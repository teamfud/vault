import "server-only";
import { db } from "./db";
import { clientIp } from "./request";
import type { Prisma } from "@/generated/prisma/client";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "TOTP_FAIL"
  | "TOTP_ENABLE"
  | "TOTP_DISABLE"
  | "PASSWORD_CHANGE"
  | "REVEAL"
  | "COPY"
  | "CREATE"
  | "UPDATE"
  | "ROLLBACK"
  | "DELETE"
  | "IMPORT"
  | "EXPORT"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_RESET_PASSWORD"
  | "USER_RESET_TOTP";

export async function audit(entry: {
  user: { id: string; username: string } | null;
  username?: string;
  action: AuditAction;
  targetType?: "credential" | "box" | "user";
  targetId?: string;
  summary?: string;
  meta?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({
    data: {
      userId: entry.user?.id,
      username: entry.user?.username ?? entry.username,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      summary: entry.summary,
      meta: entry.meta,
      ip: await clientIp(),
    },
  });
}
