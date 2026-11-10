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
  it('renders existing modes and reuses validated tenant balances in the Saldo mode', async () => {
    const { client,from } = mockClient()
    render(<FluxoCaixa client={client} organizationId={org} />)

    expect(screen.getByText('Fluxo de Caixa — Entradas e Saídas Efetivas')).toBeInTheDocument()

    const projectedBtn = screen.getByRole('button', { name: 'Projetado' })
    fireEvent.click(projectedBtn)
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/A visão projetada considera exclusivamente obrigações efetivas/)).toBeInTheDocument()

    const saldoBtn = screen.getByRole('button', { name: 'Saldo' })
    fireEvent.click(saldoBtn)
    expect(saldoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Saldos contábeis de caixa e bancos')).toBeInTheDocument()
    expect(screen.getByText(/Não representam saldo bancário conciliado/)).toBeInTheDocument()
    expect(await screen.findByText(/R\$\s?125,27/)).toBeInTheDocument()
    expect(from).toHaveBeenCalledWith('v_financial_account_balances')
    expect(from).toHaveBeenCalledWith('financial_accounts')
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
