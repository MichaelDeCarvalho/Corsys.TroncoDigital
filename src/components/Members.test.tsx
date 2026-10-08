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
})
