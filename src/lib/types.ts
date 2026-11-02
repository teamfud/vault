export type FormState = { error?: string; ok?: string } | null;

/** What an admin has to type to wipe the vault (see admin/import/resetAction.ts). */
export const RESET_PHRASE = "reset everything";
