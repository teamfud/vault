// Public link lifetimes offered in the UI, in hours (null = until unpublished).
export const EXPIRY_OPTIONS = {
  never: null,
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "72h": 72,
} as const satisfies Record<string, number | null>;

export type Expiry = keyof typeof EXPIRY_OPTIONS;
