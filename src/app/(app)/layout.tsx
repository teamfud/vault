import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "../login/actions";
import { Badge } from "@/components/ui";
import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser({ allowPasswordChange: true });
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-border bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link href="/" className="flex items-center gap-2">
            <span className="hover-wobble">
              <Logo size={30} />
            </span>
            <span className="hidden font-display text-lg sm:inline">{BRAND.name}</span>
          </Link>
          <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 text-sm sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0">
            <NavLink href="/">boxes</NavLink>
            {isAdmin && (
              <>
                <NavLink href="/admin/boxes">manage boxes</NavLink>
                <NavLink href="/admin/users">users</NavLink>
                <NavLink href="/admin/import">import / export</NavLink>
                <NavLink href="/admin/audit">audit log</NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm sm:ml-0">
            <Link href="/account" className="hidden items-center gap-2 text-muted hover:text-fg sm:flex">
              {user.username}
              {isAdmin && <Badge tone="accent">admin</Badge>}
            </Link>
            <form action={logout}>
              <button className="rounded-md border-2 border-transparent px-2 py-0.5 text-muted hover:border-border hover:text-fg cursor-pointer">log off</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="py-6 text-center text-[11px] text-muted">
        made with fud by {BRAND.team} :)
      </footer>
    </div>
  );
}
