import { act, fireEvent, render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { NewPassword, RecoveryRequest } from './PasswordRecovery'

const password = 'fixture-password-123'
function mockClient() {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }
  return { auth, client: { auth } as unknown as SupabaseClient }
}
function fill(confirmation = password) {
  fireEvent.change(screen.getByLabelText('Nova senha', { selector: 'input' }), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: confirmation } })
  fireEvent.submit(screen.getByRole('form', { name: 'Nova senha' }))
}

describe('Password recovery', () => {
  it('requests a link on the current origin and shows a non-enumerating message', async () => {
    const mock = mockClient()
    render(<RecoveryRequest client={mock.client} onBack={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'test@example.invalid' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Recuperação de senha' }))
    await screen.findByRole('status')
    expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.invalid', { redirectTo: window.location.origin + '/' })
    expect(screen.getByRole('status')).toHaveTextContent('Se houver uma conta')
  })
  it('rejects mismatched passwords without making an API request', async () => {
    const mock = mockClient()
    render(<NewPassword client={mock.client} userId="user-a" onFinish={vi.fn()} />)
    fill('different-password-123')
    expect(screen.getByRole('alert')).toHaveTextContent('confirme a mesma senha')
    expect(mock.auth.getUser).not.toHaveBeenCalled()
    expect(mock.auth.updateUser).not.toHaveBeenCalled()
  })
  it('denies an identity change before updating the password and clears sensitive fields', async () => {
    const mock = mockClient()
    mock.auth.getUser.mockResolvedValue({ data: { user: { id: 'other-user' } }, error: null })
    render(<NewPassword client={mock.client} userId="user-a" onFinish={vi.fn()} />)
    fill()
    await screen.findByRole('alert')
    expect(mock.auth.updateUser).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nova senha', { selector: 'input' })).toHaveValue('')
    expect(screen.getByLabelText('Confirmar nova senha')).toHaveValue('')
  })
  it('updates once, reports success and requires an explicit return to login', async () => {
    const mock = mockClient()
    const finish = vi.fn()
    let resolve!: (value: { data: object; error: null }) => void
    const pending = new Promise<{ data: object; error: null }>(done => { resolve = done })
    mock.auth.updateUser.mockReturnValue(pending)
    render(<NewPassword client={mock.client} userId="user-a" onFinish={finish} />)
    fill()
    fireEvent.submit(screen.getByRole('form', { name: 'Nova senha' }))
    await screen.findByRole('button', { name: 'Salvando…' })
    await act(async () => { resolve({ data: {}, error: null }); await pending })
    await screen.findByRole('status')
    expect(mock.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password })
    expect(finish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao acesso' }))
    expect(finish).toHaveBeenCalledOnce()
  })
  it('does not report success or echo backend details on update failure', async () => {
    const mock = mockClient()
    mock.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'backend-private-detail' } })
    render(<NewPassword client={mock.client} userId="user-a" onFinish={vi.fn()} />)
    fill()
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('backend-private-detail')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nova senha', { selector: 'input' })).toHaveValue('')
  })
})
