import { render, screen, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { FluxoCaixa } from './FluxoCaixa'

const org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'
const account='a7618966-ad8e-466b-b11d-2ca52ce6372d'
function mockClient(foreignAccount=false) {
  const rpc = vi.fn().mockImplementation(() => Object.assign(Promise.resolve({
    data: [
      {
        movement_day: '2026-10-01',
        received: '1500.00',
        paid: '500.00',
        realized_net: '1000.00',
        member_receivables_due: '200.00',
        institutional_receivables_due: '300.00',
        institution_payables_due: '100.00',
        projected_net: '400.00',
      },
    ],
    error: null,
  }), {abortSignal: async () => ({data:null,error:{code:'42501'}})}))
  const from=vi.fn((name:string)=>{
    const data=name==='financial_accounts'
      ? [{id:account,organization_id:foreignAccount?'foreign':org,name:'Caixa da Loja',account_type:'cash',active:true}]
      : name==='v_financial_account_balances'
        ? [{organization_id:org,financial_account_id:account,balance:'125.27'}]
        : []
    const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,range:()=>q,
      abortSignal:()=>Promise.resolve({data,error:null})}
    return q
  })
  return { client: { rpc, from } as unknown as SupabaseClient,from,rpc }
}

describe('FluxoCaixa view', () => {
  it('renders existing modes, enforces var(--surface-2) on the Projetado notice exclusively in Projetado mode, and reuses validated tenant balances in the Saldo mode', async () => {
    const { client,from } = mockClient()
    render(<FluxoCaixa client={client} organizationId={org} />)

    expect(screen.getByText('Fluxo de Caixa — Entradas e Saídas Efetivas')).toBeInTheDocument()

    const consolidadoBtn = screen.getByRole('button', { name: 'Consolidado' })
    const projectedBtn = screen.getByRole('button', { name: 'Projetado' })
    const movimentosBtn = screen.getByRole('button', { name: 'Receitas × Desp.' })
    const saldoBtn = screen.getByRole('button', { name: 'Saldo' })
    const projectedNoticeText =
      'A visão projetada considera exclusivamente obrigações efetivas confirmadas com vencimento no período selecionado, sem projeções probabilísticas fictícias.'

    // Initial Consolidado mode: notice must not be rendered
    expect(consolidadoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'false')
    expect(movimentosBtn).toHaveAttribute('aria-pressed', 'false')
    expect(saldoBtn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(projectedNoticeText)).not.toBeInTheDocument()

    // Projetado mode: notice rendered with var(--surface-2) and without light fallback #f3f4f6
    fireEvent.click(projectedBtn)
    expect(consolidadoBtn).toHaveAttribute('aria-pressed', 'false')
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(movimentosBtn).toHaveAttribute('aria-pressed', 'false')
    expect(saldoBtn).toHaveAttribute('aria-pressed', 'false')

    const notice = screen.getByText(projectedNoticeText)
    expect(notice).toBeInTheDocument()
    expect(notice.getAttribute('style')).toContain('background: var(--surface-2)')
    expect(notice.getAttribute('style')).not.toContain('#f3f4f6')
    expect(notice.getAttribute('style')).not.toContain('--highlight')

    // Receitas × Desp. mode: notice hidden again
    fireEvent.click(movimentosBtn)
    expect(consolidadoBtn).toHaveAttribute('aria-pressed', 'false')
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'false')
    expect(movimentosBtn).toHaveAttribute('aria-pressed', 'true')
    expect(saldoBtn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(projectedNoticeText)).not.toBeInTheDocument()

    // Saldo mode: notice remains hidden and validated tenant balances are displayed
    fireEvent.click(saldoBtn)
    expect(consolidadoBtn).toHaveAttribute('aria-pressed', 'false')
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'false')
    expect(movimentosBtn).toHaveAttribute('aria-pressed', 'false')
    expect(saldoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(projectedNoticeText)).not.toBeInTheDocument()
    expect(screen.getByText('Saldos contábeis de caixa e bancos')).toBeInTheDocument()
    expect(screen.getByText(/Não representam saldo bancário conciliado/)).toBeInTheDocument()
    expect(await screen.findByText(/R\$\s?125,27/)).toBeInTheDocument()
    expect(from).toHaveBeenCalledWith('v_financial_account_balances')
    expect(from).toHaveBeenCalledWith('financial_accounts')
  })

  it('preserves the chosen date range when switching V35 modes, but resets it for a different Loja', () => {
    const { client } = mockClient()
    const { rerender } = render(<FluxoCaixa client={client} organizationId={org} />)

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-05-03' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-05-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar período' }))

    fireEvent.click(screen.getByRole('button', { name: 'Projetado' }))
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-05-03')
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-05-10')

    fireEvent.click(screen.getByRole('button', { name: 'Receitas × Desp.' }))
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-05-03')
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-05-10')

    fireEvent.click(screen.getByRole('button', { name: 'Saldo' }))
    expect(screen.getByLabelText('De')).toHaveValue('2026-05-03')
    expect(screen.getByLabelText('Até')).toHaveValue('2026-05-10')

    fireEvent.click(screen.getByRole('button', { name: 'Consolidado' }))
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-05-03')
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-05-10')

    rerender(<FluxoCaixa client={client} organizationId="b112d600-bf1a-4bfd-bc1c-e9e9b749b539" />)
    expect(screen.getByLabelText('Data inicial')).not.toHaveValue('2026-05-03')
    expect(screen.getByLabelText('Data final')).not.toHaveValue('2026-05-10')
  })

  it('does not disclose balances from a foreign organization', async () => {
    const { client } = mockClient(true)
    render(<FluxoCaixa client={client} organizationId={org} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saldo' }))
    expect(await screen.findByText('Não foi possível consultar os saldos de caixa e banco com segurança.')).toBeInTheDocument()
    expect(screen.queryByText(/R\$\s?125,27/)).not.toBeInTheDocument()
  })

  it('shows the server ranking and historical balance independently of the page', async () => {
    const { client, rpc } = mockClient()
    rpc.mockImplementation((name:string,args:{p_from_date:string;p_to_date:string;p_page:number})=>{
      const from=Date.parse(args.p_from_date+'T00:00:00Z')
      const count=(Date.parse(args.p_to_date+'T00:00:00Z')-from)/86400000+1
      const history=Array.from({length:count},(_,index)=>({
        day:new Date(from+index*86400000).toISOString().slice(0,10),balance:93,
      }))
      expect(name).toBe('read_tenant_cash_flow_detail')
      return {abortSignal:async()=>({error:null,data:{
        organization_id:org,page:args.p_page,total:0,rows:[],opening:100,closing:93,
        history,expense_net:7,expenses:[{category_id:account,category:'Energia',amount:7}],
      }})}
    })
    render(<FluxoCaixa client={client} organizationId={org} />)
    fireEvent.click(screen.getByRole('button',{name:'Saldo'}))
    expect(await screen.findByText('Evolução do saldo contábil')).toBeInTheDocument()
    expect(screen.getByText(/Saldo inicial:.*100,00.*Saldo final:.*93,00/)).toBeInTheDocument()
  })
})
