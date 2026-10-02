import { AppShell } from './components/AppShell'

const foundations = [
  ['Interface', 'Web responsiva preparada para computador e celular'],
  ['Dados', 'Supabase preparado como camada de Auth, PostgreSQL e RLS'],
  ['Deploy', 'Cloudflare Workers + Static Assets'],
  ['Entrega', 'GitHub com verificação automatizada da base técnica'],
]

export default function App() {
  return (
    <AppShell>
      <section className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7 md:p-9">
          <p className="text-sm font-medium text-cyan-300">Fundação V35</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Corsys.TroncoDigital
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Base técnica inicial do sistema de tesouraria, preparada para receber os módulos funcionais
            da V35 sem expor segredos nem misturar responsabilidades de frontend e backend.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {foundations.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="font-semibold text-slate-100">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  )
}
