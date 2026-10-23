"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" || path.startsWith("/boxes") : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${active ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
    >
      {children}
    </Link>
  );
}
