import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { AccountingPrepublication, parsePrepublicationReport } from './AccountingPrepublication'

const planId = 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const ready = {
  plan_id: planId, status: 'draft', ready: true, issues: [],
  account_count: 91, analytic_account_count: 68,
  active_category_count: 4, missing_category_count: 0,
  active_financial_account_count: 1, missing_financial_account_count: 0,
  invalid_category_mapping_count: 0, invalid_financial_mapping_count: 0,
  invalid_hierarchy_count: 0, hierarchy_cycle_count: 0,
  overlapping_published_plan_count: 0,
}
function mock(result: unknown = ready, failure: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({data:result,error:failure})
  return {client:{rpc} as unknown as SupabaseClient,rpc}
}

describe('Accounting prepublication diagnostic', () => {
  it('shows the server-reported missing links and prevents publication', async () => {
    const {client,rpc} = mock({...ready,ready:false,issues:['categories_unmapped','cash_accounts_unmapped'],
      missing_category_count:2,missing_financial_account_count:1})
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId}/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Publicação bloqueada: existem pendências no plano.')
    expect(screen.getByText('Existem categorias financeiras ativas sem vínculo contábil.')).toBeInTheDocument()
    expect(screen.getByText('Existem contas financeiras ativas sem vínculo patrimonial.')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('preview_accounting_plan_publication',{
      p_organization_id:'org',p_plan_id:planId,
    })
    expect(screen.queryByRole('button',{name:/publicar plano/i})).not.toBeInTheDocument()
  })

  it('marks ready as a snapshot and does not call any publish command', async () => {
    const {client,rpc} = mock()
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId}/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    expect(screen.getByText(/A publicação permanece desabilitada/)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).not.toHaveBeenCalledWith('publish_accounting_plan',expect.anything())
  })

  it('rejects mismatched tenant plan IDs and inconsistent or unknown issue codes', () => {
    expect(() => parsePrepublicationReport({...ready,plan_id:'foreign-plan'},planId)).toThrow()
    expect(() => parsePrepublicationReport({...ready,ready:true,issues:['categories_unmapped']},planId)).toThrow()
    expect(() => parsePrepublicationReport({...ready,ready:false,issues:['unrecognized_issue']},planId)).toThrow()
    expect(() => parsePrepublicationReport({...ready,active_category_count:-1},planId)).toThrow()
  })

  it('fails closed after a permission error without displaying a previous success', async () => {
    const {client,rpc} = mock(null,{code:'42501'})
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId}/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Seu perfil ou a assinatura da Loja não autoriza esta verificação.')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Sem impedimentos técnicos nesta verificação.')).not.toBeInTheDocument()
  })

  it('disables the preview while another accounting mutation is uncertain', () => {
    const {client,rpc} = mock()
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId} disabled/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('clears old diagnostics when the selected plan changes', async () => {
    const {client} = mock()
    const {rerender} = render(<AccountingPrepublication client={client} organizationId="org" planId={planId}/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    rerender(<AccountingPrepublication client={client} organizationId="org"
      planId="d15a5af6-b90c-4a25-8e61-2a44434405ab"/>)
    await waitFor(() => expect(screen.queryByText('Sem impedimentos técnicos nesta verificação.')).not.toBeInTheDocument())
  })
})
