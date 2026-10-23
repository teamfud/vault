"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit handler for a useActionState action that, unlike `<form action>`,
 * doesn't make React clear the fields afterwards — so a rejected submit
 * keeps what the user typed.
 */
export function keepFields(action: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => action(form));
  };
}
