import { fireEvent, render, screen, within } from '@testing-library/react'
import { Members } from './Members'
import type { Member } from '../lib/tenant-data'

const members: Member[] = [
  { id: 'a', organization_id: 'org', full_name: 'João Carvalho', preferred_name: 'Joca', status: 'active', degree_or_office: 'Tesoureiro', phone: '(41) 3333-2222', whatsapp: '(41) 99999-8888', email: 'joao@example.invalid', admission_date: '2026-09-01', notes: '<script>texto cadastral</script>' },
  { id: 'b', organization_id: 'org', full_name: 'Maria Souza', status: 'away' },
]

describe('Member consultation', () => {
  it('searches accented and preferred names, formatted phone and email, combines situation and clears filters', () => {
    render(<Members members={members} />)
    const search = screen.getByLabelText('Buscar integrante')
    for (const query of ['joao', 'Joca', '41999998888', 'joao@example.invalid']) {
      fireEvent.change(search, { target: { value: query } })
      expect(screen.getByText('João Carvalho')).toBeInTheDocument()
      expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument()
    }
    fireEvent.change(screen.getByLabelText('Situação cadastral'), { target: { value: 'away' } })
    expect(screen.getByText('Nenhum integrante encontrado.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(search).toHaveValue('')
    expect(screen.getByLabelText('Situação cadastral')).toHaveValue('all')
  })

  it('opens the persisted cadastral fields with date-only formatting and renders notes as text', () => {
    render(<Members members={members} />)
    fireEvent.click(screen.getByText('João Carvalho'))
    const details = screen.getByText('João Carvalho').closest('details')!
    expect(details).toHaveAttribute('open')
    expect(within(details).getByText('01/09/2026')).toBeVisible()
    expect(within(details).getByText('<script>texto cadastral</script>')).toBeVisible()
    expect(details.querySelector('script')).toBeNull()
    expect(screen.getByText('Tesoureiro')).toBeInTheDocument()
    fireEvent.click(screen.getByText('João Carvalho'))
    expect(details).not.toHaveAttribute('open')
  })

  it('displays financial error alert when financial query fails', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockResolvedValue({ data: null, error: new Error('Permission denied') })
              })
            }),
            abortSignal: vi.fn().mockResolvedValue({ data: null, error: new Error('Permission denied') })
          })
        })
      })
    } as any

    render(<Members members={members} client={mockClient} organizationId="org-1" />)
    const alert = await screen.findByText(/Falha de leitura nas views financeiras autorizadas/i)
    expect(alert).toBeInTheDocument()
  })

  it('triggers integrity mismatch warning when integrity_ok is false', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'v_member_financial_position') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockResolvedValue({
                  data: [{ member_id: 'a', open_receivables: 100, available_credit: 0, net_position: 100, integrity_ok: false }],
                  error: null
                })
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  abortSignal: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              }),
              abortSignal: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        }
      })
    } as any

    render(<Members members={members} client={mockClient} organizationId="org-1" />)
    const warning = await screen.findByText(/Alerta de Integridade/i)
    expect(warning).toBeInTheDocument()
  })

  it('loads real communication history from v_member_communication_status without hardcoded sample items', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockImplementation(() => {
            if (table === 'v_member_communication_status') {
              return Promise.resolve({
                data: [
                  {
                    id: 'comm-1',
                    channel: 'email',
                    purpose: 'Cobrança mensal emitida',
                    latest_status: 'sent',
                    created_at: '2026-10-12T10:00:00Z',
                  },
                ],
                error: null,
              })
            }
            return Promise.resolve({ data: [], error: null })
          }),
        }
        return builder
      }),
    } as any

    render(<Members members={members} client={mockClient} organizationId="org-1" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Composição financeira' })[0])

    expect(await screen.findByText(/E-mail — Cobrança mensal emitida/)).toBeInTheDocument()
    expect(screen.getByText('Enviado')).toBeInTheDocument()
    expect(screen.queryByText(/WhatsApp — lembrete de vencimento/)).not.toBeInTheDocument()
  })

  it('computes running balance across multiple statement debits and payments inside drawer period and handles multi-channel/empty/denied communications', async () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const d1 = `${yyyy}-${mm}-01`
    const d2 = `${yyyy}-${mm}-02`
    const d3 = `${yyyy}-${mm}-03`

    let commScenario: 'multi' | 'empty' | 'denied' = 'multi'

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockImplementation(() => {
            if (table === 'v_member_statement') {
              return Promise.resolve({
                data: [
                  { event_at: d1, event_type: 'charge', description: 'Mensalidade', competence: `${yyyy}-${mm}`, debit: 200, credit: 0 },
                  { event_at: d2, event_type: 'payment', description: 'Pagamento parcial', competence: `${yyyy}-${mm}`, debit: 0, credit: 80 },
                  { event_at: d3, event_type: 'charge', description: 'Ágape', competence: `${yyyy}-${mm}`, debit: 50, credit: 0 },
                ],
                error: null,
              })
            }
            if (table === 'v_member_communication_status') {
              if (commScenario === 'denied') {
                return Promise.resolve({ data: null, error: { code: '42501', message: 'denied' } })
              }
              if (commScenario === 'empty') {
                return Promise.resolve({ data: [], error: null })
              }
              return Promise.resolve({
                data: [
                  { id: 'c1', channel: 'email', purpose: 'Boleto emitido', latest_status: 'sent', created_at: `${d1}T10:00:00Z` },
                  { id: 'c2', channel: 'whatsapp', purpose: 'Aviso de vencimento', latest_status: 'failed', created_at: `${d2}T14:00:00Z` },
                ],
                error: null,
              })
            }
            return Promise.resolve({ data: [], error: null })
          }),
        }
        return builder
      }),
    } as any

    const { rerender } = render(<Members members={members} client={mockClient} organizationId="org-1" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Composição financeira' })[0])

    expect(await screen.findByText('Mensalidade')).toBeInTheDocument()
    expect(screen.getByText('Pagamento parcial')).toBeInTheDocument()
    expect(screen.getByText('Ágape')).toBeInTheDocument()
    expect(screen.getByText('3 lançamento(s)')).toBeInTheDocument()

    const body = document.getElementById('drawerStatementBody')!
    const rows = body.querySelectorAll('tr')
    expect(rows).toHaveLength(3)
    // Running balances: +200 -> +120 -> +170
    expect(rows[0]).toHaveTextContent(/200,00/)
    expect(rows[1]).toHaveTextContent(/120,00/)
    expect(rows[2]).toHaveTextContent(/170,00/)

    expect(screen.getByText(/E-mail — Boleto emitido/)).toBeInTheDocument()
    expect(screen.getByText(/WhatsApp — Aviso de vencimento/)).toBeInTheDocument()
    expect(screen.getByText('Falhou')).toBeInTheDocument()

    // Test empty communication state
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    commScenario = 'empty'
    rerender(<Members members={members} client={mockClient} organizationId="org-1" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Composição financeira' })[1])
    expect(await screen.findByText('Nenhuma comunicação registrada para este integrante no backend.')).toBeInTheDocument()

    // Test denied communication state
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    commScenario = 'denied'
    rerender(<Members members={members} client={mockClient} organizationId="org-1" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Composição financeira' })[0])
    expect(await screen.findByText('Seu perfil não possui permissão para consultar o histórico de comunicações.')).toBeInTheDocument()
  })
})

