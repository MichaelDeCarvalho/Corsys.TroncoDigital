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
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId} validFrom="2038-01-01" validTo="2038-12-31"/>)
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
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId} validFrom="2038-01-01" validTo="2038-12-31"/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    expect(screen.getByText(/O banco fará outra verificação sob bloqueio transacional/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name:'Publicar plano contábil' })).toBeDisabled()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).not.toHaveBeenCalledWith('publish_accounting_plan',expect.anything())
  })


  it('publishes only after explicit confirmation and passes exact expected vigence with idempotency', async () => {
    const {client,rpc} = mock()
    const onPublished = vi.fn()
    rpc.mockResolvedValueOnce({data:ready,error:null}).mockResolvedValueOnce({data:planId,error:null})
    render(<AccountingPrepublication client={client} organizationId="org"
      planId={planId} validFrom="2038-01-01" validTo="2038-12-31" onPublished={onPublished}/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    expect(screen.getByRole('button',{name:'Publicar plano contábil'})).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo da publicação'),{target:{value:'Plano aprovado pela administração'}})
    fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo a vigência/}))
    fireEvent.submit(screen.getByRole('form',{name:'Publicar plano contábil'}))
    await waitFor(()=>expect(onPublished).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('publish_validated_accounting_plan',expect.objectContaining({
      p_organization_id:'org',p_plan_id:planId,
      p_expected_valid_from:'2038-01-01',p_expected_valid_to:'2038-12-31',
      p_reason:'Plano aprovado pela administração',
      p_idempotency_key:expect.any(String),
    }))
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button',{name:'Publicar plano contábil'})).not.toBeInTheDocument()
    expect(screen.getByText('Plano contábil publicado e registrado na auditoria.')).toBeInTheDocument()
  })

  it('retries an ambiguous publication response with the identical request', async () => {
    const {client,rpc} = mock()
    rpc.mockResolvedValueOnce({data:ready,error:null})
      .mockRejectedValueOnce(new Error('transport'))
      .mockResolvedValueOnce({data:planId,error:null})
    render(<AccountingPrepublication client={client} organizationId="org"
      planId={planId} validFrom="2038-01-01" validTo="2038-12-31"/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    fireEvent.change(screen.getByLabelText('Motivo da publicação'),{target:{value:'Aprovação anual'}})
    fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo a vigência/}))
    fireEvent.submit(screen.getByRole('form',{name:'Publicar plano contábil'}))
    await screen.findByRole('button',{name:'Verificar envio da publicação'})
    expect(screen.getByRole('button',{name:'Publicar plano contábil'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Verificar envio da publicação'}))
    await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(3))
    expect(rpc.mock.calls[2]).toEqual(rpc.mock.calls[1])
    await screen.findByText('Plano contábil publicado e registrado na auditoria.')
  })

  it('fails closed if a formerly ready plan loses readiness before publication', async () => {
    const {client,rpc} = mock()
    rpc.mockResolvedValueOnce({data:ready,error:null})
      .mockResolvedValueOnce({data:null,error:{code:'23514'}})
    render(<AccountingPrepublication client={client} organizationId="org"
      planId={planId} validFrom="2038-01-01" validTo="2038-12-31"/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    fireEvent.change(screen.getByLabelText('Motivo da publicação'),{target:{value:'Pronto para publicar'}})
    fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo a vigência/}))
    fireEvent.submit(screen.getByRole('form',{name:'Publicar plano contábil'}))
    await screen.findByText('O plano perdeu as condições de publicação. Atualize os dados e execute outra verificação.')
    expect(screen.queryByRole('button',{name:'Publicar plano contábil'})).not.toBeInTheDocument()
    expect(screen.queryByText('Plano contábil publicado e registrado na auditoria.')).not.toBeInTheDocument()
  })

  it('does not accept mismatched publication response as success', async () => {
    const {client,rpc} = mock()
    rpc.mockResolvedValueOnce({data:ready,error:null})
      .mockResolvedValueOnce({data:'00000000-0000-0000-0000-000000000000',error:null})
    const onPublished = vi.fn()
    render(<AccountingPrepublication client={client} organizationId="org"
      planId={planId} validFrom="2038-01-01" validTo="2038-12-31" onPublished={onPublished}/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    fireEvent.change(screen.getByLabelText('Motivo da publicação'),{target:{value:'Aprovação anual'}})
    fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo a vigência/}))
    fireEvent.submit(screen.getByRole('form',{name:'Publicar plano contábil'}))
    await screen.findByRole('button',{name:'Verificar envio da publicação'})
    expect(onPublished).not.toHaveBeenCalled()
  })

  it('rejects mismatched tenant plan IDs and inconsistent or unknown issue codes', () => {
    expect(() => parsePrepublicationReport({...ready,plan_id:'foreign-plan'},planId)).toThrow()
    expect(() => parsePrepublicationReport({...ready,ready:true,issues:['categories_unmapped']},planId)).toThrow()
    expect(() => parsePrepublicationReport({...ready,ready:false,issues:['unrecognized_issue']},planId)).toThrow()
    expect(() => parsePrepublicationReport({...ready,active_category_count:-1},planId)).toThrow()
  })

  it('fails closed after a permission error without displaying a previous success', async () => {
    const {client,rpc} = mock(null,{code:'42501'})
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId} validFrom="2038-01-01" validTo="2038-12-31"/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Seu perfil ou a assinatura da Loja não autoriza esta verificação.')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Sem impedimentos técnicos nesta verificação.')).not.toBeInTheDocument()
  })

  it('disables the preview while another accounting mutation is uncertain', () => {
    const {client,rpc} = mock()
    render(<AccountingPrepublication client={client} organizationId="org" planId={planId} validFrom="2038-01-01" validTo="2038-12-31" disabled/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('clears old diagnostics when the selected plan changes', async () => {
    const {client} = mock()
    const {rerender} = render(<AccountingPrepublication client={client} organizationId="org" planId={planId} validFrom="2038-01-01" validTo="2038-12-31"/>)
    fireEvent.click(screen.getByRole('button',{name:'Verificar condições de publicação'}))
    await screen.findByText('Sem impedimentos técnicos nesta verificação.')
    rerender(<AccountingPrepublication client={client} organizationId="org"
      planId="d15a5af6-b90c-4a25-8e61-2a44434405ab"
      validFrom="2039-01-01" validTo="2039-12-31"/>)
    await waitFor(() => expect(screen.queryByText('Sem impedimentos técnicos nesta verificação.')).not.toBeInTheDocument())
  })
})
