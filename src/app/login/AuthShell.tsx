import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="-rotate-6 hover-wobble">
            <Logo size={52} />
          </div>
          <div>
            <p className="text-xs text-muted">{BRAND.team} presents</p>
            <p className="font-display text-3xl leading-none">vault :)</p>
          </div>
        </div>
        <div className="rounded-lg border-2 border-border bg-panel p-6 shadow-sticker-lg">
          <h1 className="mb-5 font-display text-xl">{title}</h1>
          {children}
        </div>
        <p className="mt-6 text-center text-[11px] text-muted">red team pls go away ♡</p>
      </div>
    </main>
  );
}
