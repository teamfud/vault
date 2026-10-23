import { db } from "./db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "./auth";
import { assertMasterKey } from "./crypto";

/** Runs once at server start: validate config and seed the first admin. */
export async function bootstrap() {
  assertMasterKey();
  if ((await db.user.count()) > 0) return;

  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < MIN_PASSWORD_LENGTH) {
    console.warn(
      `[vault] No users exist. Set ADMIN_USERNAME and ADMIN_PASSWORD (>= ${MIN_PASSWORD_LENGTH} chars) to create the first admin.`,
    );
    return;
  }
  await db.user.create({
    data: { username, passwordHash: await hashPassword(password), role: "ADMIN", mustChangePassword: true },
  });
  console.log(`[vault] Created initial admin "${username}". You will be asked to change the password on first login.`);
}
