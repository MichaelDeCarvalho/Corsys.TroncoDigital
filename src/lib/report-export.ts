export type ReportSnapshot = {
  title: string
  organizationId: string
  scope: string
  filters: string
  headers: string[]
  rows: (string | number)[][]
}

export function validateReport(report: ReportSnapshot) {
  if (!report.organizationId || !report.title || !report.scope || !report.headers.length || report.rows.length > 2000 ||
    report.rows.some(row => row.length !== report.headers.length || row.some(value =>
      typeof value === 'number' ? !Number.isFinite(value) : typeof value !== 'string'))) {
    throw Error('Relatório incompleto ou inválido para exportação.')
  }
}

export async function createReportWorkbook(report: ReportSnapshot): Promise<Blob> {
  validateReport(report)
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  // Explicit String cells preserve untrusted text as text, never as formulas.
  const cell = (value: string | number) => typeof value === 'number'
    ? { value, type: Number, format: '#,##0.00' }
    : { value, type: String }
  return writeExcelFile([
    [cell(report.title)],
    [cell('Loja'), cell(report.organizationId)],
    [cell('Abrangência'), cell(report.scope)],
    [cell('Filtros'), cell(report.filters)],
    [cell('Gerado em'), cell(new Date().toISOString())],
    [],
    report.headers.map(value => ({ ...cell(value), fontWeight: 'bold' as const })),
    ...report.rows.map(row => row.map(cell)),
  ], { sheet: 'Relatório', columns: report.headers.map(() => ({ width: 24 })) }).toBlob()
}

export function downloadReport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function printReport(report: ReportSnapshot) {
  validateReport(report)
  const popup = window.open('', '_blank', 'width=1100,height=800')
  if (!popup) throw Error('Permita a abertura da janela de impressão para salvar o PDF.')
  popup.opener = null
  const doc = popup.document
  doc.title = report.title
  doc.documentElement.lang = 'pt-BR'
  doc.body.replaceChildren()
  const add = (tag: string, text: string, parent: HTMLElement = doc.body) => {
    const node = doc.createElement(tag)
    node.textContent = text
    parent.append(node)
    return node
  }
  add('h1', report.title)
  add('p', `Loja: ${report.organizationId}`)
  add('p', `Abrangência: ${report.scope}`)
  add('p', `Filtros: ${report.filters}`)
  add('p', `Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  const table = add('table', '')
  const head = add('thead', '', table)
  const header = add('tr', '', head)
  report.headers.forEach(value => add('th', value, header))
  const body = add('tbody', '', table)
  report.rows.forEach(values => {
    const row = add('tr', '', body)
    values.forEach(value => add('td', typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : value, row))
  })
  const style = doc.createElement('style')
  style.textContent = 'body{font:12px Arial;color:#111;background:white;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:6px;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:12mm}'
  doc.head.append(style)
  popup.focus()
  popup.print()
}
