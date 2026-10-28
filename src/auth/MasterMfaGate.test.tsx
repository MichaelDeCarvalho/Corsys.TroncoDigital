import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { MasterMfaGate, mfaQrImage } from './MasterMfaGate'
import { loadMasterOverview } from '../lib/master-console'

vi.mock('../lib/master-console', () => ({ loadMasterOverview: vi.fn() }))
const overview = vi.mocked(loadMasterOverview)
const factor = { id: 'verified-factor', status: 'verified', factor_type: 'totp', friendly_name: 'Meu autenticador' }
function makeClient(master = true) {
  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null }),
    listFactors: vi.fn().mockResolvedValue({ data: { all: [], totp: [] }, error: null }),
    enroll: vi.fn().mockResolvedValue({ data: { id: 'new-factor', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' } }, error: null }),
    unenroll: vi.fn().mockResolvedValue({ error: null }),
    challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
  }
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'master-user' } }, error: null })
  const abortSignal = vi.fn().mockResolvedValue({ data: master ? [{ user_id: 'master-user', role: 'MASTER', active: true }] : [], error: null })
  const eq = vi.fn().mockReturnValue({ abortSignal })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { client: { auth: { getUser, mfa }, from } as unknown as SupabaseClient, mfa, getUser, abortSignal, from, eq }
}
function show(mock: ReturnType<typeof makeClient>) {
  return render(<MasterMfaGate client={mock.client} userId="master-user" onSignOut={vi.fn()}><p>Área autorizada</p></MasterMfaGate>)
}
async function enterCode() {
  fireEvent.change(await screen.findByLabelText('Código do autenticador'), { target: { value: '123456' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Verificar MFA Master' }))
}
beforeEach(() => { overview.mockReset(); overview.mockResolvedValue({} as Awaited<ReturnType<typeof loadMasterOverview>>) })

describe('Master MFA boundary', () => {
  it('keeps normal tenant access without calling MFA or the Master RPC', async () => {
    const mock = makeClient(false); show(mock)
    await screen.findByText('Área autorizada')
    expect(mock.eq).toHaveBeenCalledWith('user_id', 'master-user')
    expect(mock.mfa.listFactors).not.toHaveBeenCalled()
    expect(overview).not.toHaveBeenCalled()
  })
  it('blocks access on failed staff lookup instead of treating failure as a tenant', async () => {
    const mock = makeClient(); mock.abortSignal.mockResolvedValue({ data: null, error: { message: 'unavailable' } }); show(mock)
    await screen.findByRole('alert')
    expect(screen.queryByText('Área autorizada')).not.toBeInTheDocument()
  })
  it('rejects a staff record for a different user', async () => {
    const mock = makeClient(); mock.abortSignal.mockResolvedValue({ data: [{ user_id: 'other', role: 'MASTER', active: true }], error: null }); show(mock)
    await screen.findByRole('alert')
    expect(mock.mfa.enroll).not.toHaveBeenCalled()
    expect(screen.queryByText('Área autorizada')).not.toBeInTheDocument()
  })
  it('offers explicit enrollment before querying privileged Master data', async () => {
    const mock = makeClient(); show(mock)
    const button = await screen.findByRole('button', { name: 'Configurar MFA' })
    expect(mock.mfa.enroll).not.toHaveBeenCalled()
    expect(overview).not.toHaveBeenCalled()
    fireEvent.click(button); fireEvent.click(button)
    await screen.findByAltText('QR para configurar seu autenticador')
    expect(mock.mfa.enroll).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Área autorizada')).not.toBeInTheDocument()
  })
  it('uses an existing verified factor without enrolling or removing it', async () => {
    const mock = makeClient(); mock.mfa.listFactors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null }); show(mock)
    await screen.findByLabelText('Código do autenticador')
    expect(mock.mfa.enroll).not.toHaveBeenCalled()
    expect(mock.mfa.unenroll).not.toHaveBeenCalled()
  })
  it('keeps the boundary closed for a rejected code and clears the input', async () => {
    const mock = makeClient(); mock.mfa.listFactors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null })
    mock.mfa.challengeAndVerify.mockResolvedValue({ error: { message: 'incorrect' } }); show(mock)
    await enterCode(); await screen.findByRole('alert')
    expect(screen.getByLabelText('Código do autenticador')).toHaveValue('')
    expect(overview).not.toHaveBeenCalled()
    expect(screen.queryByText('Área autorizada')).not.toBeInTheDocument()
  })
  it('does not accept verification success while assurance remains AAL1', async () => {
    const mock = makeClient(); mock.mfa.listFactors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null }); show(mock)
    await enterCode(); await screen.findByRole('alert')
    expect(overview).not.toHaveBeenCalled()
    expect(screen.queryByText('Área autorizada')).not.toBeInTheDocument()
  })
  it('requires AAL2 plus the existing server authorization before rendering children', async () => {
    const mock = makeClient(); mock.mfa.listFactors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null })
    mock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: { currentLevel: 'aal1' }, error: null }).mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null })
    show(mock); await enterCode(); await screen.findByText('Área autorizada')
    expect(overview).toHaveBeenCalledTimes(1)
    expect(mock.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'verified-factor', code: '123456' })
  })
  it('blocks a revoked role even with an already AAL2 session', async () => {
    const mock = makeClient(); mock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null })
    overview.mockRejectedValue(new Error('permission denied')); show(mock)
    await screen.findByRole('alert')
    expect(screen.queryByText('Área autorizada')).not.toBeInTheDocument()
  })
  it('does not enroll when the signed-in identity changes before the click', async () => {
    const mock = makeClient(); show(mock)
    const button = await screen.findByRole('button', { name: 'Configurar MFA' })
    mock.getUser.mockResolvedValue({ data: { user: { id: 'other' } }, error: null })
    fireEvent.click(button); await screen.findByRole('alert')
    expect(mock.mfa.enroll).not.toHaveBeenCalled()
  })
  it('replaces only this app\'s unverified enrollment after an explicit click', async () => {
    const mock = makeClient()
    const own = { id: 'unfinished', status: 'unverified', factor_type: 'totp', friendly_name: 'CorSys Master' }
    const other = { ...own, id: 'different-app', friendly_name: 'Other app' }
    mock.mfa.listFactors.mockResolvedValue({ data: { all: [own, other], totp: [] }, error: null })
    show(mock)
    expect(mock.mfa.unenroll).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar MFA' }))
    await screen.findByAltText('QR para configurar seu autenticador')
    expect(mock.mfa.unenroll).toHaveBeenCalledTimes(1)
    expect(mock.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'unfinished' })
  })
  it('does not render a late enrollment response after unmount', async () => {
    const mock = makeClient()
    let resolve!: (value: unknown) => void
    mock.mfa.enroll.mockImplementation(() => new Promise(done => { resolve = done }))
    const view = show(mock)
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar MFA' }))
    await waitFor(() => expect(mock.mfa.enroll).toHaveBeenCalledTimes(1))
    view.unmount()
    resolve({ data: { id: 'late', type: 'totp', totp: { qr_code: '<svg></svg>' } }, error: null })
    expect(screen.queryByAltText('QR para configurar seu autenticador')).not.toBeInTheDocument()
  })
  it('encodes raw SVG as an image and refuses remote QR URLs', () => {
    expect(mfaQrImage('<?xml version="1.0"?><!-- Generated --><svg></svg>')).toMatch(/^data:image\/svg\+xml;/)
    expect(() => mfaQrImage('https://untrusted.invalid/qr')).toThrow()
  })
})
