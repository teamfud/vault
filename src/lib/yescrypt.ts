import { randomBytes } from "node:crypto";
import { Yescrypt } from "yescrypt-wasm";

/*
 * `$y$` yescrypt hashes for /etc/shadow, via yescrypt-wasm (the yescrypt C
 * reference compiled to WebAssembly). Checked against libxcrypt output in
 * yescrypt.test.ts. Call this from a worker (see yescryptPool.ts): WASM memory
 * only grows, so the pool's idle workers exiting is what hands it back.
 */

let instance: Promise<Yescrypt> | null = null;
const yescrypt = () => (instance ??= Yescrypt.init());

/** libxcrypt's cost → (N, r) mapping, as used by `mkpasswd -m yescrypt -R <cost>`. */
export function costParams(cost: number) {
  if (!Number.isInteger(cost) || cost < 1 || cost > 11) throw new Error("cost must be 1-11");
  return cost < 3 ? { N: 2 ** (cost + 9), r: 8 } : { N: 2 ** (cost + 7), r: 32 };
}

/** New `$y$` hash with a random 16-byte salt; cost 5 matches Debian/Ubuntu's default. */
export async function yescryptHash(password: string, cost = 5): Promise<string> {
  const { N, r } = costParams(cost);
  return (await yescrypt()).yescrypt_hash(Buffer.from(password, "utf8"), randomBytes(16), N, r, 1);
}

/** Raw access for tests that replay libxcrypt settings. */
export async function yescryptRaw(password: Buffer, salt: Uint8Array, N: number, r: number, p: number, t: number) {
  return (await yescrypt()).yescrypt_hash(password, salt, N, r, p, t);
}
