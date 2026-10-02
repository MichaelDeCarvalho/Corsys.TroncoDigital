import { Home, Menu } from 'lucide-react'
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Corsys</p>
            <p className="font-semibold">Tronco Digital</p>
          </div>
          <button type="button" className="rounded-xl border border-white/10 p-2 text-slate-200" aria-label="Abrir navegação">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div className="mx-auto grid min-h-screen max-w-[1600px] md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/10 bg-slate-950 p-6 md:block">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Corsys</p>
            <h1 className="mt-1 text-xl font-semibold">Tronco Digital</h1>
            <p className="mt-2 text-sm text-slate-400">V35</p>
          </div>
          <nav aria-label="Navegação principal">
            <button type="button" className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-left text-sm text-white">
              <Home size={18} />
              Início
            </button>
          </nav>
        </aside>

        <main className="min-w-0 p-4 pb-24 sm:p-6 md:p-8 md:pb-8">{children}</main>
      </div>

      <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 px-2 py-2 backdrop-blur md:hidden">
        <button type="button" className="mx-auto flex min-h-14 w-24 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] text-cyan-300">
          <Home size={19} />
          <span>Início</span>
        </button>
      </nav>
    </div>
  )
}
