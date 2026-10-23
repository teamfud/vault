import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

const key = randomBytes(32);

describe("crypto", () => {
  it("round-trips", () => {
    for (const s of ["", "hunter2", "P@ss w0rd ✓ 🔐", "x".repeat(5000)]) {
      expect(decrypt(encrypt(s, "cred:1", key), "cred:1", key)).toBe(s);
    }
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same", "a", key)).not.toBe(encrypt("same", "a", key));
  });

  it("rejects a blob bound to a different row", () => {
    expect(() => decrypt(encrypt("secret", "cred:1", key), "cred:2", key)).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const [v, iv, tag, ct] = encrypt("secret", "a", key).split(":");
    const bytes = Buffer.from(ct, "base64");
    bytes[0] ^= 1;
    expect(() => decrypt([v, iv, tag, bytes.toString("base64")].join(":"), "a", key)).toThrow();
  });

  it("rejects the wrong key", () => {
    expect(() => decrypt(encrypt("secret", "a", key), "a", randomBytes(32))).toThrow();
  });

  it("rejects malformed blobs", () => {
    expect(() => decrypt("garbage", "a", key)).toThrow(/Malformed/);
  });
});
