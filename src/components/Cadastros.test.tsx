import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { Cadastros } from './Cadastros'
import type { Member } from '../lib/tenant-data'

const ORG_ID = '94b84958-4dd9-435d-9a4e-244220835d70'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ROLE_ID = '22222222-2222-4222-8222-222222222222'
const TREASURER_ROLE_ID = '33333333-3333-4333-8333-333333333333'

const sampleMembers: Member[] = [
  {
    id: 'mem-1',
    organization_id: ORG_ID,
    full_name: 'Carlos Alberto',
    status: 'active',
    degree_or_office: 'Mestre'
  }
]

function createMockSupabaseClient(options?: {
  lastAdminError?: boolean
}): SupabaseClient {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'revoke_tenant_user_role' && options?.lastAdminError) {
      return {
        data: null,
        error: {
          code: '55000',
          message: 'cannot remove last administrator from store'
        }
      }
    }
    if (name === 'assign_tenant_user_role' || name === 'revoke_tenant_user_role') {
      return { data: USER_ID, error: null }
    }
    throw new Error(`Unexpected RPC call: ${name}`)
  })

  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      abortSignal: () => builder,
      then: (resolve: (r: unknown) => void) => {
        let data: unknown[] = []
        if (table === 'roles') {
          data = [
            {
              id: ADMIN_ROLE_ID,
              organization_id: ORG_ID,
              code: 'ADMIN',
              name: 'Administrador',
              is_system: true
            },
            {
              id: TREASURER_ROLE_ID,
              organization_id: ORG_ID,
              code: 'TREASURER',
              name: 'Tesoureiro',
              is_system: true
            }
          ]
        } else if (table === 'permissions') {
          data = [
            { code: 'users.manage', description: 'Gerenciar usuários e perfis' },
            { code: 'members.read', description: 'Consultar integrantes' }
          ]
        } else if (table === 'role_permissions') {
          data = [
            { role_id: ADMIN_ROLE_ID, permission_code: 'users.manage' },
            { role_id: TREASURER_ROLE_ID, permission_code: 'members.read' }
          ]
        } else if (table === 'user_roles') {
          data = [
            { organization_id: ORG_ID, user_id: USER_ID, role_id: ADMIN_ROLE_ID }
          ]
        } else if (table === 'member_user_links') {
          data = [
            { organization_id: ORG_ID, member_id: 'mem-1', user_id: USER_ID }
          ]
        } else if (table === 'members') {
          data = [
            { id: 'mem-1', full_name: 'Carlos Alberto', email: 'carlos@example.com' }
          ]
        } else if (table === 'user_profiles') {
          data = [{ user_id: USER_ID, display_name: 'Carlos Alberto' }]
        }

        resolve({ data, error: null })
      }
    }
    return builder
  })

  return { rpc, from } as unknown as SupabaseClient
}

describe('Cadastros Component (Cadastros.tsx)', () => {
  it('renders Integrantes tab by default and switches between tabs', () => {
    const client = createMockSupabaseClient()
    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    expect(screen.getByText('Cadastros Administrativos')).toBeInTheDocument()
    expect(screen.getByText('Carlos Alberto')).toBeInTheDocument()

    // Switch to Cargos e Vínculos
    fireEvent.click(screen.getByRole('button', { name: 'Cargos e Vínculos' }))
    expect(screen.getByText('Cargos e Tipos de Vínculo')).toBeInTheDocument()
    expect(screen.getByText('Mestre')).toBeInTheDocument()
  })

  it('loads and renders RBAC roles and users in Perfis e Permissões tab', async () => {
    const client = createMockSupabaseClient()
    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))

    await screen.findByText('Perfis e Permissões da Conta (RBAC)')
    await screen.findByText(/Administrador \(ADMIN\)/)
    await screen.findByRole('option', { name: /\+ Tesoureiro/ })
    await screen.findByText(/Gerenciar usuários e perfis/)

    // Verifies user row
    expect(screen.getAllByText('Carlos Alberto').length).toBeGreaterThan(0)
  })

  it('triggers role assignment modal and executes assignment', async () => {
    const client = createMockSupabaseClient()
    const onReload = vi.fn()

    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
        onReload={onReload}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    // Select available role Tesoureiro
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: TREASURER_ROLE_ID } })

    const assignButton = screen.getByRole('button', { name: 'Atribuir' })
    fireEvent.click(assignButton)

    // Modal appears
    await screen.findByText('Atribuir Perfil de Acesso')

    const reasonInput = screen.getByLabelText(/Justificativa da alteração/)
    fireEvent.change(reasonInput, { target: { value: 'Atribuição aprovada na reunião de diretoria' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Alteração' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/Perfil Tesoureiro atribuído com sucesso/)).toBeInTheDocument()
    })

    expect(onReload).toHaveBeenCalled()
  })

  it('displays error when attempting to remove the last administrator', async () => {
    const client = createMockSupabaseClient({ lastAdminError: true })

    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    // Click revoke on Admin role badge button
    const revokeButton = screen.getByTitle('Revogar perfil Administrador')
    fireEvent.click(revokeButton)

    await screen.findByText('Revogar Perfil de Acesso')

    const reasonInput = screen.getByLabelText(/Justificativa da alteração/)
    fireEvent.change(reasonInput, { target: { value: 'Tentativa de revogação de admin' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Alteração' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('Não é possível remover o único administrador da Loja.')).toBeInTheDocument()
    })
  })

  it('enforces dialog semantics, initial focus, Tab/Shift+Tab containment before and during pending Assign RPC, prevents duplicate submission, and closes cleanly on success', async () => {
    let resolveAssign: ((value: unknown) => void) | undefined
    const baseClient = createMockSupabaseClient()
    const rpc = vi.fn((name: string) => {
      if (name === 'assign_tenant_user_role') {
        return new Promise((resolve) => {
          resolveAssign = resolve
        })
      }
      return baseClient.rpc(name as never)
    })
    const client = { ...baseClient, rpc } as unknown as SupabaseClient

    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    const externalTabBtn = screen.getByRole('button', { name: 'Perfis e Permissões' })
    fireEvent.click(externalTabBtn)
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: TREASURER_ROLE_ID } })

    const assignButton = screen.getByRole('button', { name: 'Atribuir' })
    assignButton.focus()
    fireEvent.click(assignButton)

    const dialog = await screen.findByRole('dialog', { name: 'Atribuir Perfil de Acesso' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'rbac-modal-title')

    const closeBtn = screen.getByRole('button', { name: 'Fechar modal' })
    const reasonInput = screen.getByLabelText(/Justificativa da alteração/)
    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' })
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar Alteração' })

    // Initial focus placed inside the dialog on the justification input
    expect(reasonInput).toHaveFocus()
    expect(confirmBtn).toBeDisabled()

    // While confirmBtn is disabled, Tab cycles across [closeBtn, reasonInput, cancelBtn]
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(cancelBtn).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeBtn).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(cancelBtn).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(reasonInput).toHaveFocus()

    // Enabling confirmBtn includes it in the Tab cycle
    fireEvent.change(reasonInput, { target: { value: 'Atribuição revisada' } })
    expect(confirmBtn).not.toBeDisabled()

    confirmBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeBtn).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirmBtn).toHaveFocus()

    // Escape closes the modal and restores focus to the Atribuir button without calling RPC
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(assignButton).toHaveFocus()
    expect(rpc).not.toHaveBeenCalled()

    // Reopen Assign modal and start pending RPC
    fireEvent.click(assignButton)
    const pendingDialog = await screen.findByRole('dialog', { name: 'Atribuir Perfil de Acesso' })
    fireEvent.change(screen.getByLabelText(/Justificativa da alteração/), {
      target: { value: 'Atribuição aprovada em ata' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Alteração' }))

    // During pending RPC: all modal controls are disabled, focus remains inside dialog
    const processingBtn = screen.getByRole('button', { name: 'Processando...' })
    expect(processingBtn).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fechar modal' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText(/Justificativa da alteração/)).toBeDisabled()
    expect(pendingDialog.contains(document.activeElement)).toBe(true)
    expect(pendingDialog).toHaveFocus()

    // Duplicate submission is prevented while RPC is pending
    fireEvent.click(processingBtn)
    expect(rpc).toHaveBeenCalledTimes(1)

    // Tab and Shift+Tab remain trapped inside the dialog and never reach external controls
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(pendingDialog.contains(document.activeElement)).toBe(true)
    expect(externalTabBtn).not.toHaveFocus()
    expect(assignButton).not.toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(pendingDialog.contains(document.activeElement)).toBe(true)
    expect(externalTabBtn).not.toHaveFocus()
    expect(assignButton).not.toHaveFocus()

    // Escape does not close the modal during pending RPC
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Atribuir Perfil de Acesso' })).toBeInTheDocument()

    // Resolve RPC and verify modal closes properly
    resolveAssign?.({ data: USER_ID, error: null })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText(/Perfil Tesoureiro atribuído com sucesso/)).toBeInTheDocument()
  })

  it('enforces focus containment during pending Revoke RPC and restores accessible focus inside the dialog after RPC error', async () => {
    let resolveRevoke: ((value: unknown) => void) | undefined
    const baseClient = createMockSupabaseClient()
    const rpc = vi.fn((name: string) => {
      if (name === 'revoke_tenant_user_role') {
        return new Promise((resolve) => {
          resolveRevoke = resolve
        })
      }
      return baseClient.rpc(name as never)
    })
    const client = { ...baseClient, rpc } as unknown as SupabaseClient

    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    const revokeButton = screen.getByTitle('Revogar perfil Administrador')
    revokeButton.focus()
    fireEvent.click(revokeButton)

    const dialog = await screen.findByRole('dialog', { name: 'Revogar Perfil de Acesso' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'rbac-modal-title')

    const closeBtn = screen.getByRole('button', { name: 'Fechar modal' })
    const reasonInput = screen.getByLabelText(/Justificativa da alteração/)
    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' })

    expect(reasonInput).toHaveFocus()

    // Tab trap inside Revoke modal before submission
    cancelBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeBtn).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(cancelBtn).toHaveFocus()

    // Escape closes Revoke modal and restores focus to the Revoke button
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(revokeButton).toHaveFocus()
    expect(rpc).not.toHaveBeenCalled()

    // Reopen Revoke modal, start submission, and verify focus containment while in flight
    fireEvent.click(revokeButton)
    const pendingDialog = await screen.findByRole('dialog', { name: 'Revogar Perfil de Acesso' })
    fireEvent.change(screen.getByLabelText(/Justificativa da alteração/), {
      target: { value: 'Revogação autorizada em ata' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Alteração' }))

    expect(screen.getByRole('button', { name: 'Processando...' })).toBeDisabled()
    expect(pendingDialog.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(pendingDialog.contains(document.activeElement)).toBe(true)
    expect(revokeButton).not.toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(pendingDialog.contains(document.activeElement)).toBe(true)
    expect(revokeButton).not.toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Revogar Perfil de Acesso' })).toBeInTheDocument()

    // Resolve with last-admin error and verify focus returns to an enabled interactive control inside the dialog
    resolveRevoke?.({
      data: null,
      error: {
        code: '55000',
        message: 'cannot remove last administrator from store',
      },
    })

    await waitFor(() => {
      expect(screen.getByText('Não é possível remover o único administrador da Loja.')).toBeInTheDocument()
    })

    const activeDialog = screen.getByRole('dialog', { name: 'Revogar Perfil de Acesso' })
    const reenabledCloseBtn = screen.getByRole('button', { name: 'Fechar modal' })
    const reenabledCancelBtn = screen.getByRole('button', { name: 'Cancelar' })
    const lockedReasonInput = screen.getByLabelText(/Justificativa da alteração/)

    // Reason input stays locked for idempotency, while focus moves to the enabled close button inside the dialog
    expect(lockedReasonInput).toBeDisabled()
    expect(reenabledCloseBtn).not.toBeDisabled()
    expect(reenabledCloseBtn).toHaveFocus()
    expect(activeDialog.contains(document.activeElement)).toBe(true)

    // Tab continues cycling only across enabled controls inside the dialog
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(reenabledCancelBtn).toHaveFocus()

    // Closing after error restores focus to the trigger button
    fireEvent.click(reenabledCancelBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(revokeButton).toHaveFocus()
  })
})

describe('Cadastros M04 seat usage & limit handling', () => {
  it('loads seat usage on explicit check and shows localized message when plan seat limit is reached', async () => {
    const base = createMockSupabaseClient()
    const rpc = vi.fn(async (name: string) => {
      if (name === 'read_tenant_seat_usage') {
        return {
          data: {
            organization_id: ORG_ID,
            active_users: 3,
            max_admin_users: 3,
            seats_remaining: 0,
            over_limit: false,
            plan_id: 'p1',
            plan_version_id: 'v1',
            plan_name: 'Corsys Essencial',
            plan_code: 'corsys_essencial_125',
            subscription_status: 'active',
          },
          error: null,
        }
      }
      if (name === 'assign_tenant_user_role') {
        return { data: null, error: { code: '55000', message: 'plan seat limit reached: max_admin_users=3' } }
      }
      return { data: USER_ID, error: null }
    })
    const client = { ...base, rpc } as unknown as SupabaseClient

    render(<Cadastros members={sampleMembers} client={client} organizationId={ORG_ID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    fireEvent.click(screen.getByRole('button', { name: 'Consultar assentos do plano' }))
    expect(await screen.findByText(/3 \/ 3 — Plano Corsys Essencial/)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: TREASURER_ROLE_ID } })
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir' }))
    fireEvent.change(await screen.findByLabelText(/Justificativa da alteração/), { target: { value: 'Teste limite plano' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Alteração' }))
    await screen.findByText(/Limite de usuários ativos do plano contratado atingido/)
  })
})
