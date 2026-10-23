import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

/*
 * yescrypt in the `$y$` crypt(3) format used by /etc/shadow on modern Linux
 * (libxcrypt). Ported from the yescrypt reference implementation
 * (yescrypt-ref.c / yescrypt-common.c, Alexander Peslyak, BSD-2-Clause) and
 * checked against libxcrypt output in yescrypt.test.ts.
 *
 * Only the yescrypt "RW" flavor libxcrypt emits is supported: no ROM, no
 * hash upgrades (g), p = 1 by default.
 */

const YESCRYPT_RW = 0x002;
const YESCRYPT_DEFAULTS = 0x0b6; // RW | ROUNDS_6 | GATHER_4 | SIMPLE_2 | SBOX_12K
const YESCRYPT_PREHASH = 0x10000000;

// pwxform settings fixed by YESCRYPT_DEFAULTS
const PWX_SIMPLE = 2;
const PWX_GATHER = 4;
const PWX_ROUNDS = 6;
const SWIDTH = 8;
const PWX_WORDS = (PWX_GATHER * PWX_SIMPLE * 8) / 4; // 16
const S_BYTES = 3 * (1 << SWIDTH) * PWX_SIMPLE * 8; // 12288
const S_WORDS = S_BYTES / 4;
const S_MASK = ((1 << SWIDTH) - 1) * PWX_SIMPLE * 8; // byte offset mask
const S_PART_WORDS = (1 << SWIDTH) * PWX_SIMPLE * 2; // words per S0/S1/S2
const W_MASK = (1 << SWIDTH) * PWX_SIMPLE - 1;

type Params = { flags: number; N: number; r: number; p: number; t: number };

// ---------------------------------------------------------------- helpers

const bytesToWords = (b: Buffer) => {
  const w = new Uint32Array(b.length / 4);
  for (let i = 0; i < w.length; i++) w[i] = b.readUInt32LE(i * 4);
  return w;
};

const wordsToBytes = (w: Uint32Array, start = 0, count = w.length - start) => {
  const b = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i++) b.writeUInt32LE(w[start + i], i * 4);
  return b;
};

const hmac = (key: Buffer, msg: Buffer) => createHmac("sha256", key).update(msg).digest();
const pbkdf2 = (pw: Buffer, salt: Buffer, len: number) => pbkdf2Sync(pw, salt, 1, len, "sha256");

function blkcpy(dst: Uint32Array, d: number, src: Uint32Array, s: number, n: number) {
  for (let i = 0; i < n; i++) dst[d + i] = src[s + i];
}

function blkxor(dst: Uint32Array, d: number, src: Uint32Array, s: number, n: number) {
  for (let i = 0; i < n; i++) dst[d + i] ^= src[s + i];
}

function p2floor(x: number) {
  let y;
  while ((y = x & (x - 1))) x = y;
  return x;
}

// ---------------------------------------------------------------- salsa20

const x = new Uint32Array(16);

/** Salsa20 core on B[o..o+16], with yescrypt's SIMD (un)shuffle. */
function salsa20(B: Uint32Array, o: number, rounds: number) {
  for (let i = 0; i < 16; i++) x[(i * 5) % 16] = B[o + i];
  for (let i = 0; i < rounds; i += 2) {
    let t;
    // columns
    t = (x[0] + x[12]) | 0; x[4] ^= (t << 7) | (t >>> 25);
    t = (x[4] + x[0]) | 0; x[8] ^= (t << 9) | (t >>> 23);
    t = (x[8] + x[4]) | 0; x[12] ^= (t << 13) | (t >>> 19);
    t = (x[12] + x[8]) | 0; x[0] ^= (t << 18) | (t >>> 14);
    t = (x[5] + x[1]) | 0; x[9] ^= (t << 7) | (t >>> 25);
    t = (x[9] + x[5]) | 0; x[13] ^= (t << 9) | (t >>> 23);
    t = (x[13] + x[9]) | 0; x[1] ^= (t << 13) | (t >>> 19);
    t = (x[1] + x[13]) | 0; x[5] ^= (t << 18) | (t >>> 14);
    t = (x[10] + x[6]) | 0; x[14] ^= (t << 7) | (t >>> 25);
    t = (x[14] + x[10]) | 0; x[2] ^= (t << 9) | (t >>> 23);
    t = (x[2] + x[14]) | 0; x[6] ^= (t << 13) | (t >>> 19);
    t = (x[6] + x[2]) | 0; x[10] ^= (t << 18) | (t >>> 14);
    t = (x[15] + x[11]) | 0; x[3] ^= (t << 7) | (t >>> 25);
    t = (x[3] + x[15]) | 0; x[7] ^= (t << 9) | (t >>> 23);
    t = (x[7] + x[3]) | 0; x[11] ^= (t << 13) | (t >>> 19);
    t = (x[11] + x[7]) | 0; x[15] ^= (t << 18) | (t >>> 14);
    // rows
    t = (x[0] + x[3]) | 0; x[1] ^= (t << 7) | (t >>> 25);
    t = (x[1] + x[0]) | 0; x[2] ^= (t << 9) | (t >>> 23);
    t = (x[2] + x[1]) | 0; x[3] ^= (t << 13) | (t >>> 19);
    t = (x[3] + x[2]) | 0; x[0] ^= (t << 18) | (t >>> 14);
    t = (x[5] + x[4]) | 0; x[6] ^= (t << 7) | (t >>> 25);
    t = (x[6] + x[5]) | 0; x[7] ^= (t << 9) | (t >>> 23);
    t = (x[7] + x[6]) | 0; x[4] ^= (t << 13) | (t >>> 19);
    t = (x[4] + x[7]) | 0; x[5] ^= (t << 18) | (t >>> 14);
    t = (x[10] + x[9]) | 0; x[11] ^= (t << 7) | (t >>> 25);
    t = (x[11] + x[10]) | 0; x[8] ^= (t << 9) | (t >>> 23);
    t = (x[8] + x[11]) | 0; x[9] ^= (t << 13) | (t >>> 19);
    t = (x[9] + x[8]) | 0; x[10] ^= (t << 18) | (t >>> 14);
    t = (x[15] + x[14]) | 0; x[12] ^= (t << 7) | (t >>> 25);
    t = (x[12] + x[15]) | 0; x[13] ^= (t << 9) | (t >>> 23);
    t = (x[13] + x[12]) | 0; x[14] ^= (t << 13) | (t >>> 19);
    t = (x[14] + x[13]) | 0; x[15] ^= (t << 18) | (t >>> 14);
  }
  for (let i = 0; i < 16; i++) B[o + i] = (B[o + i] + x[(i * 5) % 16]) >>> 0;
}

function blockmixSalsa8(B: Uint32Array, o: number, Y: Uint32Array, r: number) {
  const X = new Uint32Array(16);
  blkcpy(X, 0, B, o + (2 * r - 1) * 16, 16);
  for (let i = 0; i < 2 * r; i++) {
    blkxor(X, 0, B, o + i * 16, 16);
    salsa20(X, 0, 8);
    blkcpy(Y, i * 16, X, 0, 16);
  }
  for (let i = 0; i < r; i++) blkcpy(B, o + i * 16, Y, i * 2 * 16, 16);
  for (let i = 0; i < r; i++) blkcpy(B, o + (i + r) * 16, Y, (i * 2 + 1) * 16, 16);
}

// ---------------------------------------------------------------- pwxform

type Pwx = { S: Uint32Array; s0: number; s1: number; s2: number; w: number };

function pwxform(X: Uint32Array, ctx: Pwx) {
  const S = ctx.S;
  const { s0: S0, s1: S1, s2: S2 } = ctx;
  let w = ctx.w;
  for (let i = 0; i < PWX_ROUNDS; i++) {
    for (let j = 0; j < PWX_GATHER; j++) {
      const base = j * PWX_SIMPLE * 2;
      // word offsets of the selected S0/S1 lanes
      const p0 = S0 + (X[base] & S_MASK) / 4;
      const p1 = S1 + (X[base + 1] & S_MASK) / 4;
      for (let k = 0; k < PWX_SIMPLE; k++) {
        const xl = X[base + k * 2];
        const xh = X[base + k * 2 + 1];
        // 64-bit xh * xl, in 16-bit limbs so it stays exact in doubles
        const al = xh & 0xffff, ah = xh >>> 16, bl = xl & 0xffff, bh = xl >>> 16;
        const m0 = al * bl, m1 = al * bh, m2 = ah * bl, m3 = ah * bh;
        const mid = (m0 >>> 16) + (m1 & 0xffff) + (m2 & 0xffff);
        let lo = ((mid << 16) | (m0 & 0xffff)) >>> 0;
        let hi = (m3 + (m1 >>> 16) + (m2 >>> 16) + (mid >>> 16)) >>> 0;
        // + S0, xor S1
        const sum = lo + S[p0 + k * 2];
        lo = sum >>> 0;
        hi = (hi + S[p0 + k * 2 + 1] + (sum > 0xffffffff ? 1 : 0)) >>> 0;
        lo = (lo ^ S[p1 + k * 2]) >>> 0;
        hi = (hi ^ S[p1 + k * 2 + 1]) >>> 0;
        X[base + k * 2] = lo;
        X[base + k * 2 + 1] = hi;
        if (i !== 0 && i !== PWX_ROUNDS - 1) {
          S[S2 + w * 2] = lo;
          S[S2 + w * 2 + 1] = hi;
          w++;
        }
      }
    }
  }
  ctx.s0 = S2;
  ctx.s1 = S0;
  ctx.s2 = S1;
  ctx.w = w & W_MASK;
}

const pwxX = new Uint32Array(PWX_WORDS);

function blockmixPwxform(B: Uint32Array, o: number, ctx: Pwx, r: number) {
  const r1 = (128 * r) / 64;
  blkcpy(pwxX, 0, B, o + (r1 - 1) * PWX_WORDS, PWX_WORDS);
  for (let i = 0; i < r1; i++) {
    if (r1 > 1) blkxor(pwxX, 0, B, o + i * PWX_WORDS, PWX_WORDS);
    pwxform(pwxX, ctx);
    blkcpy(B, o + i * PWX_WORDS, pwxX, 0, PWX_WORDS);
  }
  let i = ((r1 - 1) * 64) / 64;
  salsa20(B, o + i * 16, 2);
  for (i++; i < 2 * r; i++) {
    blkxor(B, o + i * 16, B, o + (i - 1) * 16, 16);
    salsa20(B, o + i * 16, 2);
  }
}

// ---------------------------------------------------------------- smix

/** Low 32 bits of Integerify — every caller masks by N - 1 with N <= 2^31. */
const integerify = (X: Uint32Array, r: number) => X[(2 * r - 1) * 16];

function wrap(x: number, i: number) {
  const n = p2floor(i);
  return (x & (n - 1)) + (i - n);
}

function shuffleIn(X: Uint32Array, B: Uint32Array, o: number, r: number) {
  for (let k = 0; k < 2 * r; k++) for (let i = 0; i < 16; i++) X[k * 16 + i] = B[o + k * 16 + ((i * 5) % 16)];
}

function shuffleOut(B: Uint32Array, o: number, X: Uint32Array, r: number) {
  for (let k = 0; k < 2 * r; k++) for (let i = 0; i < 16; i++) B[o + k * 16 + ((i * 5) % 16)] = X[k * 16 + i];
}

function smix1(
  B: Uint32Array, o: number, r: number, N: number, flags: number,
  V: Uint32Array, vo: number, XY: Uint32Array, ctx: Pwx | null,
) {
  const s = 32 * r;
  const X = XY.subarray(0, s);
  const Y = XY.subarray(s, 2 * s);
  shuffleIn(X, B, o, r);
  for (let i = 0; i < N; i++) {
    blkcpy(V, vo + i * s, X, 0, s);
    if (flags & YESCRYPT_RW && i > 1) {
      const j = wrap(integerify(X, r), i);
      blkxor(X, 0, V, vo + j * s, s);
    }
    if (ctx) blockmixPwxform(X, 0, ctx, r);
    else blockmixSalsa8(X, 0, Y, r);
  }
  shuffleOut(B, o, X, r);
}

function smix2(
  B: Uint32Array, o: number, r: number, N: number, Nloop: number, flags: number,
  V: Uint32Array, vo: number, XY: Uint32Array, ctx: Pwx | null,
) {
  const s = 32 * r;
  const X = XY.subarray(0, s);
  const Y = XY.subarray(s, 2 * s);
  shuffleIn(X, B, o, r);
  for (let i = 0; i < Nloop; i++) {
    const j = integerify(X, r) & (N - 1);
    blkxor(X, 0, V, vo + j * s, s);
    if (flags & YESCRYPT_RW) blkcpy(V, vo + j * s, X, 0, s);
    if (ctx) blockmixPwxform(X, 0, ctx, r);
    else blockmixSalsa8(X, 0, Y, r);
  }
  shuffleOut(B, o, X, r);
}

/** Returns the (possibly updated) 32-byte passwd buffer. */
function smix(
  B: Uint32Array, r: number, N: number, p: number, t: number, flags: number,
  V: Uint32Array, XY: Uint32Array, ctx: Pwx[], passwd: Buffer,
): Buffer {
  const s = 32 * r;
  let Nchunk = Math.floor(N / p);
  let NloopAll = Nchunk;
  if (t <= 1) {
    if (t) NloopAll *= 2;
    NloopAll = Math.floor((NloopAll + 2) / 3);
  } else {
    NloopAll *= t - 1;
  }
  let NloopRw = Math.floor(NloopAll / p);
  Nchunk -= Nchunk % 2;
  NloopAll += NloopAll % 2;
  NloopRw += NloopRw % 2;

  for (let i = 0, Vchunk = 0; i < p; i++, Vchunk += Nchunk) {
    const Np = i < p - 1 ? Nchunk : N - Vchunk;
    const o = i * s;
    const c = ctx[i];
    smix1(B, o, 1, S_BYTES / 128, 0, c.S, 0, XY, null);
    c.s2 = 0;
    c.s1 = S_PART_WORDS;
    c.s0 = 2 * S_PART_WORDS;
    c.w = 0;
    if (i === 0) passwd = hmac(wordsToBytes(B, o + s - 16, 16), passwd);
    smix1(B, o, r, Np, flags, V, Vchunk * s, XY, c);
    smix2(B, o, r, p2floor(Np), NloopRw, flags, V, Vchunk * s, XY, c);
  }
  for (let i = 0; i < p; i++) {
    smix2(B, i * s, r, N, NloopAll - NloopRw, flags & ~YESCRYPT_RW, V, 0, XY, ctx[i]);
  }
  return passwd;
}

// ---------------------------------------------------------------- kdf

function kdfBody(passwd: Buffer, salt: Buffer, { flags, N, r, p, t }: Params, dkLen: number): Buffer {
  if ((flags & 0x3ff) !== YESCRYPT_DEFAULTS) throw new Error("unsupported yescrypt flavor");
  if (N < 2 || N & (N - 1) || N > 2 ** 30 || r < 1 || p < 1 || r * p >= 2 ** 30 || Math.floor(N / p) <= 1) {
    throw new Error("invalid yescrypt parameters");
  }
  if (128 * r * N > 1 << 30) throw new Error("yescrypt parameters need too much memory");

  const V = new Uint32Array(32 * r * N);
  const XY = new Uint32Array(64 * r);
  const ctx: Pwx[] = Array.from({ length: p }, () => ({ S: new Uint32Array(S_WORDS), s0: 0, s1: 0, s2: 0, w: 0 }));

  const prehashKey = Buffer.from(flags & YESCRYPT_PREHASH ? "yescrypt-prehash" : "yescrypt");
  const Bbytes = pbkdf2(hmac(prehashKey, passwd), salt, 128 * r * p);
  const B = bytesToWords(Bbytes);
  // From here on "passwd" is the first 32 bytes of B, updated inside smix.
  const pw = smix(B, r, N, p, t, flags, V, XY, ctx, Buffer.from(Bbytes.subarray(0, 32)));

  let out = pbkdf2(pw, wordsToBytes(B), dkLen);
  if (!(flags & YESCRYPT_PREHASH)) {
    // SCRAM-style ClientKey -> StoredKey
    const clientKey = hmac(out.subarray(0, 32), Buffer.from("Client Key"));
    out = createHash("sha256").update(clientKey).digest().subarray(0, dkLen);
  }
  return out;
}

export function yescryptKdf(passwd: Buffer, salt: Buffer, params: Params, dkLen = 32): Buffer {
  const { flags, N, r, p } = params;
  // Integer division, as in the C reference.
  const Np = Math.floor(N / p);
  if (flags & YESCRYPT_RW && p >= 1 && Np >= 0x100 && Np * r >= 0x20000) {
    passwd = kdfBody(passwd, salt, { ...params, flags: flags | YESCRYPT_PREHASH, N: N / 64, t: 0 }, 32);
  }
  return kdfBody(passwd, salt, params, dkLen);
}

// ---------------------------------------------------------------- $y$ format

const itoa64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function atoi64(c: string) {
  const v = itoa64.indexOf(c);
  return v < 0 ? 64 : v;
}

function encode64Uint32(src: number, min: number) {
  let start = 0, end = 47, chars = 1, bits = 0;
  if (src < min) throw new Error("value too small");
  src -= min;
  for (;;) {
    const count = (end + 1 - start) * 2 ** bits;
    if (src < count) break;
    if (start >= 63) throw new Error("value too large");
    start = end + 1;
    end = start + Math.floor((62 - end) / 2);
    src -= count;
    chars++;
    bits += 6;
  }
  let out = itoa64[start + Math.floor(src / 2 ** bits)];
  while (--chars) {
    bits -= 6;
    out += itoa64[Math.floor(src / 2 ** bits) & 0x3f];
  }
  return out;
}

/** Returns [value, charsConsumed]. */
function decode64Uint32(s: string, pos: number, min: number): [number, number] {
  let start = 0, end = 47, chars = 1, bits = 0;
  let c = atoi64(s[pos] ?? "");
  if (c > 63) throw new Error("bad setting");
  let dst = min;
  while (c > end) {
    dst += (end + 1 - start) * 2 ** bits;
    start = end + 1;
    end = start + Math.floor((62 - end) / 2);
    chars++;
    bits += 6;
  }
  dst += (c - start) * 2 ** bits;
  let i = pos + 1;
  while (--chars) {
    c = atoi64(s[i++] ?? "");
    if (c > 63) throw new Error("bad setting");
    bits -= 6;
    dst += c * 2 ** bits;
  }
  return [dst, i - pos];
}

function encode64(src: Buffer) {
  let out = "";
  for (let i = 0; i < src.length; ) {
    let value = 0, bits = 0;
    do {
      value |= src[i++] << bits;
      bits += 8;
    } while (bits < 24 && i < src.length);
    for (let b = 0; b < bits; b += 6) {
      out += itoa64[value & 0x3f];
      value >>>= 6;
    }
  }
  return out;
}

function decode64(src: string): Buffer {
  const out: number[] = [];
  let pos = 0;
  while (pos < src.length) {
    let value = 0, bits = 0;
    while (pos < src.length && bits < 24) {
      const c = atoi64(src[pos++]);
      if (c > 63) throw new Error("bad salt");
      value |= c << bits;
      bits += 6;
    }
    if (bits < 12) throw new Error("bad salt");
    while (bits >= 8) {
      out.push(value & 0xff);
      value >>>= 8;
      bits -= 8;
    }
    if (value) throw new Error("bad salt");
  }
  return Buffer.from(out);
}

function parseSetting(setting: string) {
  if (!setting.startsWith("$y$")) throw new Error("not a yescrypt setting");
  let pos = 3;
  const next = (min: number) => {
    const [v, n] = decode64Uint32(setting, pos, min);
    pos += n;
    return v;
  };
  const flavor = next(0);
  if (flavor < YESCRYPT_RW || flavor > YESCRYPT_RW + (0x3fc >> 2)) throw new Error("unsupported yescrypt flavor");
  const flags = YESCRYPT_RW + ((flavor - YESCRYPT_RW) << 2);
  const Nlog2 = next(1);
  if (Nlog2 > 30) throw new Error("N too large");
  const params: Params = { flags, N: 2 ** Nlog2, r: next(1), p: 1, t: 0 };
  if (setting[pos] !== "$") {
    const have = next(1);
    if (have & 1) params.p = next(2);
    if (have & 2) params.t = next(1);
    if (have & ~3) throw new Error("hash upgrades and ROMs are not supported");
  }
  if (setting[pos++] !== "$") throw new Error("bad setting");
  const end = setting.indexOf("$", pos);
  const saltStr = end < 0 ? setting.slice(pos) : setting.slice(pos, end);
  return { params, prefix: setting.slice(0, pos), saltStr };
}

/** crypt(3)-compatible: hash `password` with an existing `$y$` setting or hash string. */
export function yescryptCrypt(password: string, setting: string): string {
  const { params, prefix, saltStr } = parseSetting(setting);
  const hash = yescryptKdf(Buffer.from(password, "utf8"), decode64(saltStr), params);
  return `${prefix}${saltStr}$${encode64(hash)}`;
}

/**
 * New `$y$` hash with libxcrypt's defaults for `cost` (1-11, default 5 —
 * the same as `mkpasswd -m yescrypt` and Debian/Ubuntu's passwd).
 */
export function yescryptHash(password: string, cost = 5): string {
  if (!Number.isInteger(cost) || cost < 1 || cost > 11) throw new Error("cost must be 1-11");
  const r = cost < 3 ? 8 : 32;
  const Nlog2 = cost < 3 ? cost + 9 : cost + 7;
  const flavor = YESCRYPT_RW + (YESCRYPT_DEFAULTS >> 2);
  const setting = `$y$${encode64Uint32(flavor, 0)}${encode64Uint32(Nlog2, 1)}${encode64Uint32(r, 1)}$${encode64(randomBytes(16))}`;
  return yescryptCrypt(password, setting);
}
