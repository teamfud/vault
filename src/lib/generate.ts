const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!#%&()*+,-./:;<=>?@[]^_{|}~";
// Safe to paste into bash/PowerShell/SQL without quoting.
const SHELL_SAFE_SYMBOLS = "-_.+=@%,";

const WORDS = (
  "amber anchor arrow atlas badge basin beacon birch blaze bolt brick bronze cable canyon carbon cedar " +
  "cinder cobalt comet copper coral crane crater delta dune ember falcon fern flint forge frost garnet " +
  "glacier granite harbor hawk helix hollow iris jade jasper kelp lantern lava lumen maple marble meadow " +
  "mesa nebula nickel oasis onyx orbit otter pebble pine plasma prism quartz quiver raven reef ridge " +
  "river rocket saber sable shadow signal slate solar spark spruce summit talon thunder timber topaz " +
  "tundra valley vapor vector velvet violet walnut willow zephyr zinc"
).split(" ");

export type Preset = "strong" | "shell-safe" | "passphrase";

/** Uniform random integer in [0, max) using rejection sampling. */
function randInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

function pick(chars: string): string {
  return chars[randInt(chars.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fromClasses(length: number, classes: string[]): string {
  // One char from each class guarantees complexity rules are met.
  const out = classes.map(pick);
  const all = classes.join("");
  while (out.length < length) out.push(pick(all));
  return shuffle(out).join("");
}

export function generatePassword(preset: Preset = "strong", length = 20): string {
  switch (preset) {
    case "strong":
      return fromClasses(Math.max(length, 8), [LOWER, UPPER, DIGITS, SYMBOLS]);
    case "shell-safe":
      return fromClasses(Math.max(length, 8), [LOWER, UPPER, DIGITS, SHELL_SAFE_SYMBOLS]);
    case "passphrase": {
      const words = Array.from({ length: 4 }, () => WORDS[randInt(WORDS.length)]);
      const i = randInt(words.length);
      words[i] = words[i].toUpperCase();
      return `${words.join("-")}-${randInt(90) + 10}`;
    }
  }
}

export const charsets = { LOWER, UPPER, DIGITS, SYMBOLS, SHELL_SAFE_SYMBOLS };
