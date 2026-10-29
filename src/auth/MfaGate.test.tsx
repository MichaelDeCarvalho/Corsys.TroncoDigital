import { fireEvent, render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { MfaGate } from './MfaGate'

function setup(currentLevel = 'aal1', nextLevel = 'aal2') {
  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel, nextLevel }, error: null }),
    listFactors: vi.fn().mockResolvedValue({ data: { totp: [{ id: 'existing-factor', status: 'verified' }] }, error: null }),
    challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
  }
  const client = { auth: { mfa } } as unknown as SupabaseClient
  const onSignOut = vi.fn()
  render(<MfaGate client={client} onSignOut={onSignOut}><p>Workspace autorizado</p></MfaGate>)
  return { mfa, onSignOut }
}

it('blocks workspace until the existing TOTP is verified and AAL2 is confirmed', async () => {
  const { mfa } = setup()
  const input = await screen.findByLabelText('Código do autenticador')
  expect(screen.queryByText('Workspace autorizado')).not.toBeInTheDocument()
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
  fireEvent.change(input, { target: { value: '123456' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Confirmar MFA' }))
  await screen.findByText('Workspace autorizado')
  expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'existing-factor', code: '123456' })
})

it('retains the challenge and clears the code after rejection', async () => {
  const { mfa } = setup()
  mfa.challengeAndVerify.mockResolvedValue({ error: { message: 'rejected' } } as never)
  const input = await screen.findByLabelText('Código do autenticador')
  fireEvent.change(input, { target: { value: '123456' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Confirmar MFA' }))
  await screen.findByRole('alert')
  expect(input).toHaveValue('')
  expect(screen.queryByText('Workspace autorizado')).not.toBeInTheDocument()
})

it('does not open the workspace if verification returns success without AAL2', async () => {
  setup()
  fireEvent.change(await screen.findByLabelText('Código do autenticador'), { target: { value: '123456' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Confirmar MFA' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Workspace autorizado')).not.toBeInTheDocument()
})

it('fails closed when assurance lookup fails', async () => {
  const { mfa } = setup()
  mfa.listFactors.mockRejectedValue(new Error('offline'))
  await screen.findByRole('alert')
  expect(screen.queryByText('Workspace autorizado')).not.toBeInTheDocument()
})

it.each([['aal2', 'aal2'], ['aal1', 'aal1']])('preserves normal entry for %s/%s', async (current, next) => {
  const { mfa } = setup(current, next)
  await screen.findByText('Workspace autorizado')
  expect(mfa.listFactors).not.toHaveBeenCalled()
})

it('allows local sign out without changing MFA factors', async () => {
  const { onSignOut } = setup()
  await screen.findByLabelText('Código do autenticador')
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(onSignOut).toHaveBeenCalledTimes(1)
})
