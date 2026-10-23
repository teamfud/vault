import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { costParams, yescryptHash, yescryptRaw } from "./yescrypt";

// Generated with libxcrypt on Debian trixie: Perl crypt() over fixed settings,
// plus `mkpasswd -m yescrypt -R 1..7`. Columns: password (hex), setting,
// expected crypt() output.
const vectors = readFileSync(path.join(import.meta.dirname, "yescrypt.vectors.tsv"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hex, setting, expected] = line.split("\t");
    return { password: Buffer.from(hex, "hex"), setting, expected };
  });

// Minimal `$y$` setting parser (yescrypt-common.c) so the vectors can be replayed.
const itoa64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function decodeUint32(s: string, pos: number, min: number): [number, number] {
  let start = 0, end = 47, chars = 1, bits = 0;
  const c = itoa64.indexOf(s[pos]);
  let v = min;
  while (c > end) {
    v += (end + 1 - start) * 2 ** bits;
    start = end + 1;
    end = start + Math.floor((62 - end) / 2);
    chars++;
    bits += 6;
  }
  v += (c - start) * 2 ** bits;
  let i = pos + 1;
  while (--chars) {
    bits -= 6;
    v += itoa64.indexOf(s[i++]) * 2 ** bits;
  }
  return [v, i];
}

function decodeBytes(src: string) {
  const out: number[] = [];
  for (let pos = 0; pos < src.length; ) {
    let v = 0, bits = 0;
    while (pos < src.length && bits < 24) {
      v |= itoa64.indexOf(src[pos++]) << bits;
      bits += 6;
    }
    for (; bits >= 8; bits -= 8, v >>>= 8) out.push(v & 0xff);
  }
  return Uint8Array.from(out);
}

function parseSetting(s: string) {
  let pos = 3;
  const next = (min: number) => {
    const [v, end] = decodeUint32(s, pos, min);
    pos = end;
    return v;
  };
  next(0); // flavor: always the default here
  const N = 2 ** next(1);
  const r = next(1);
  let p = 1, t = 0;
  if (s[pos] !== "$") {
    const have = next(1);
    if (have & 1) p = next(2);
    if (have & 2) t = next(1);
  }
  const salt = s.slice(pos + 1).split("$")[0];
  return { N, r, p, t, salt: decodeBytes(salt) };
}

describe("yescrypt", () => {
  it("matches libxcrypt on every reference vector", async () => {
    expect(vectors.length).toBeGreaterThan(50);
    for (const { password, setting, expected } of vectors) {
      const { N, r, p, t, salt } = parseSetting(setting);
      expect(await yescryptRaw(password, salt, N, r, p, t), `${password.toString("utf8")} ${setting}`).toBe(expected);
    }
  });

  it("generates default-cost hashes with a fresh salt", async () => {
    const a = await yescryptHash("hunter2");
    expect(a).toMatch(/^\$y\$j9T\$[./0-9A-Za-z]{22}\$[./0-9A-Za-z]{43}$/);
    expect(await yescryptHash("hunter2")).not.toBe(a);
  });

  it("generated hashes verify against the same password only", async () => {
    const hash = await yescryptHash("hunter2", 3);
    const { N, r, p, t, salt } = parseSetting(hash);
    expect(await yescryptRaw(Buffer.from("hunter2"), salt, N, r, p, t)).toBe(hash);
    expect(await yescryptRaw(Buffer.from("hunter3"), salt, N, r, p, t)).not.toBe(hash);
  });

  it("maps costs like libxcrypt and rejects out-of-range ones", () => {
    expect(costParams(1)).toEqual({ N: 1024, r: 8 });
    expect(costParams(5)).toEqual({ N: 4096, r: 32 });
    expect(() => costParams(0)).toThrow();
    expect(() => costParams(12)).toThrow();
  });
});
