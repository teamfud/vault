import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo size={44} />
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent">{BRAND.team}</p>
            <p className="text-lg font-semibold leading-tight">vault</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-panel p-6">
          <h1 className="mb-4 text-base font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
