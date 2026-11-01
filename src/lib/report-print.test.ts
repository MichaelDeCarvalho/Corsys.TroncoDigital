import { printReport } from './report-export'

it('prints an isolated document with literal text and no executable report content', () => {
  const doc = document.implementation.createHTMLDocument('')
  const popup = { document: doc, opener: window, focus: vi.fn(), print: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  printReport({ title: 'DRE', organizationId: 'org-1', scope: 'Competência consultada', filters: '2026-11', headers: ['Conta', 'Valor'], rows: [['<img src=x onerror=alert(1)>', 10.5]] })
  expect(popup.opener).toBeNull()
  expect(doc.querySelector('img')).toBeNull()
  expect(doc.body.textContent).toContain('<img src=x onerror=alert(1)>')
  expect(doc.body.textContent).toContain('Competência consultada')
  expect(popup.print).toHaveBeenCalledOnce()
  open.mockRestore()
})

it('reports blocked print windows as an error', () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  expect(() => printReport({ title: 'DRE', organizationId: 'org-1', scope: 'Página', filters: '', headers: ['Valor'], rows: [[1]] })).toThrow('Permita')
  open.mockRestore()
})
