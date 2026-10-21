import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { MemberForm } from './MemberForm'

const resultId = 'ab48a944-bf5b-4c12-a5b7-75c6d8ec69ee'
function setup(rpc = vi.fn().mockResolvedValue({ data: resultId, error: null }), member = null as null | { id: string; organization_id: string; full_name: string; status: string; updated_at: string }) {
  const onSaved = vi.fn(), onCancel = vi.fn(), onReload = vi.fn()
  const rendered = render(<MemberForm client={{ rpc } as unknown as SupabaseClient} organizationId="org-a" member={member} onSaved={onSaved} onCancel={onCancel} onReload={onReload} />)
  return { rpc, onSaved, onCancel, onReload, ...rendered }
}

describe('Member save flow', () => {
  it('releases an uncertain command after a definitive PT409 so the user can reload or cancel', async () => {
    const member = { id: resultId, organization_id: 'org-a', full_name: 'Teste', status: 'active', updated_at: '2026-10-08T10:00:00.123456+00:00' }
    const rpc = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: null, error: { code: 'PT409' } })
    const { onSaved } = setup(rpc, member)
    fireEvent.change(screen.getByLabelText('Motivo do registro'), { target: { value: 'Correção cadastral' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastro de integrante' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar e confirmar envio' }))
    await screen.findByText('Este cadastro foi alterado por outra operação. Sua edição não foi salva. Atualize o cadastro antes de editar novamente.')
    expect(screen.queryByRole('button', { name: 'Verificar e confirmar envio' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Atualizar cadastro' })).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
  })
  it('guards duplicate submissions and sends the selected tenant, cadastral fields and idempotency key', async () => {
    let resolve!: (value: unknown) => void
    const pending = new Promise(done => { resolve = done })
    const { rpc, onSaved } = setup(vi.fn().mockReturnValue(pending))
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: ' Novo integrante ' } })
    const form = screen.getByRole('form', { name: 'Cadastro de integrante' })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('save_member_profile', expect.objectContaining({ p_organization_id: 'org-a', p_member_id: null, p_expected_updated_at: null, p_profile: expect.objectContaining({ full_name: 'Novo integrante' }), p_idempotency_key: expect.any(String) }))
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    await act(async () => { resolve({ data: resultId, error: null }); await pending })
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('locks ambiguous submissions and retries exactly the same payload and key without reporting success early', async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: resultId, error: null })
    const { onSaved } = setup(rpc)
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Teste' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastro de integrante' }))
    await screen.findByRole('alert')
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nome completo')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar e confirmar envio' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
  })

  it('preserves the exact backend version and rejects stale-edit success until reload', async () => {
    const member = { id: resultId, organization_id: 'org-a', full_name: 'Teste', status: 'active', updated_at: '2026-10-08T10:00:00.123456+00:00' }
    const { rpc, onSaved, onReload } = setup(vi.fn().mockResolvedValue({ data: null, error: { code: '40001' } }), member)
    fireEvent.change(screen.getByLabelText('Motivo do registro'), { target: { value: 'Correção cadastral' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastro de integrante' }))
    await screen.findByRole('alert')
    expect(rpc).toHaveBeenCalledWith('save_member_profile', expect.objectContaining({ p_member_id: resultId, p_expected_updated_at: member.updated_at }))
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Salvar integrante' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar cadastro' }))
    expect(onReload).toHaveBeenCalledOnce()
  })

  it('does not let a late save callback update a workspace that has unmounted', async () => {
    let resolve!: (value: unknown) => void
    const pending = new Promise(done => { resolve = done })
    const { unmount, onSaved } = setup(vi.fn().mockReturnValue(pending))
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Teste' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastro de integrante' }))
    unmount()
    await act(async () => { resolve({ data: resultId, error: null }); await pending })
    expect(onSaved).not.toHaveBeenCalled()
  })
})
