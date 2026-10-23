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
      <header className="sticky top-0 z-20 border-b border-border bg-panel/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo size={28} />
            <span className="hidden sm:inline">{BRAND.name}</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            <NavLink href="/">Boxes</NavLink>
            {isAdmin && (
              <>
                <NavLink href="/admin/boxes">Manage boxes</NavLink>
                <NavLink href="/admin/users">Users</NavLink>
                <NavLink href="/admin/import">Import / Export</NavLink>
                <NavLink href="/admin/audit">Audit log</NavLink>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/account" className="hidden items-center gap-2 text-muted hover:text-fg sm:flex">
              {user.username}
              {isAdmin && <Badge tone="accent">admin</Badge>}
            </Link>
            <form action={logout}>
              <button className="rounded-md px-2 py-1 text-muted hover:bg-panel-2 hover:text-fg cursor-pointer">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
