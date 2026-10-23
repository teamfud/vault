import { generate, generateSecret } from "otplib";
import { describe, expect, it } from "vitest";
import { checkCode } from "./totp";

describe("checkCode", () => {
  const secret = generateSecret();

  it("accepts the current code, with or without spaces", async () => {
    const code = await generate({ secret });
    expect(await checkCode(secret, code)).toEqual(expect.any(Number));
    expect(await checkCode(secret, `${code.slice(0, 3)} ${code.slice(3)}`)).toEqual(expect.any(Number));
  });

  it("returns null instead of throwing on malformed codes", async () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5", "١٢٣٤٥٦"]) {
      await expect(checkCode(secret, bad)).resolves.toBeNull();
    }
  });

  it("rejects a replayed time step", async () => {
    const code = await generate({ secret });
    const step = await checkCode(secret, code);
    expect(await checkCode(secret, code, step!)).toBeNull();
  });
});
