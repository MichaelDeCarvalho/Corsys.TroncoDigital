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

export type IntegralBookExport = {
  title: string
  bookType: 'DIARIO' | 'RAZAO' | 'DRE_GERENCIAL'
  organizationId: string
  periodLabel: string
  planMetadata: string
  filters: string
  expectedTotalCount: number
  integralOk: boolean
  incompleteReasons: string[]
  reconciledTotals: Array<{ label: string; value: string | number }>
  nonFiscalNotice: string
  headers: string[]
  rows: (string | number)[][]
}

const MAX_INTEGRAL_EXPORT_ROWS = 10000

export function validateIntegralBookExport(book: IntegralBookExport) {
  if (!book.organizationId || !book.title || !book.periodLabel || !book.planMetadata || !book.headers.length) {
    throw Error('Metadados obrigatórios ausentes para exportação integral.')
  }
  if (!book.nonFiscalNotice || !/não substitui|gerencial/i.test(book.nonFiscalNotice)) {
    throw Error('Exportação bloqueada: aviso explícito de natureza gerencial/não fiscal é obrigatório.')
  }
  if (!book.integralOk || book.incompleteReasons.length > 0) {
    throw Error('Exportação integral bloqueada: há lançamentos não mapeados ou lacunas contábeis no período.')
  }
  if (!Number.isInteger(book.expectedTotalCount) || book.expectedTotalCount < 0 || book.rows.length !== book.expectedTotalCount) {
    throw Error('Exportação integral bloqueada: conjunto de registros incompleto ou divergente da contagem do servidor.')
  }
  if (book.rows.length > MAX_INTEGRAL_EXPORT_ROWS) {
    throw Error(`Exportação excede o limite de ${MAX_INTEGRAL_EXPORT_ROWS} registros por arquivo.`)
  }
  if (
    book.reconciledTotals.some(t => !t.label || (typeof t.value === 'number' ? !Number.isFinite(t.value) : typeof t.value !== 'string')) ||
    book.rows.some(
      row =>
        row.length !== book.headers.length ||
        row.some(value => (typeof value === 'number' ? !Number.isFinite(value) : typeof value !== 'string')),
    )
  ) {
    throw Error('Exportação integral bloqueada: valores inválidos ou tabela inconsistente.')
  }
}

export async function createIntegralBookWorkbook(book: IntegralBookExport): Promise<Blob> {
  validateIntegralBookExport(book)
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const cell = (value: string | number) =>
    typeof value === 'number'
      ? { value, type: Number, format: '#,##0.00' }
      : { value, type: String }

  const summarySheet = [
    [cell(book.title)],
    [cell('Modalidade'), cell(book.bookType === 'DRE_GERENCIAL' ? 'DRE Gerencial Integral' : `${book.bookType} Integral`)],
    [cell('Loja (ID)'), cell(book.organizationId)],
    [cell('Período / Competência'), cell(book.periodLabel)],
    [cell('Plano Contábil / Vigência'), cell(book.planMetadata)],
    [cell('Filtros aplicados'), cell(book.filters || 'Nenhum')],
    [cell('Quantidade de registros'), cell(book.expectedTotalCount)],
    [cell('Status de integridade'), cell('CONCILIADO / INTEGRAL')],
    [cell('Gerado em (UTC)'), cell(new Date().toISOString())],
    [cell('Aviso legal / contábil'), cell(book.nonFiscalNotice)],
    [],
    [cell('Totais Conciliados'), cell('Valor')],
    ...book.reconciledTotals.map(t => [cell(t.label), cell(t.value)]),
  ]

  const dataSheet = [
    book.headers.map(h => ({ ...cell(h), fontWeight: 'bold' as const })),
    ...book.rows.map(row => row.map(cell)),
  ]

  return writeExcelFile([
    {
      sheet: 'Resumo e Conciliação',
      data: summarySheet,
      columns: [{ width: 34 }, { width: 48 }],
    },
    {
      sheet: 'Registros',
      data: dataSheet,
      columns: book.headers.map(() => ({ width: 24 })),
    },
  ]).toBlob()
}

export function printIntegralBookReport(book: IntegralBookExport) {
  validateIntegralBookExport(book)
  const popup = window.open('', '_blank', 'width=1200,height=850')
  if (!popup) throw Error('Permita a abertura da janela de impressão para salvar o PDF.')
  popup.opener = null
  const doc = popup.document
  doc.title = book.title
  doc.documentElement.lang = 'pt-BR'
  doc.body.replaceChildren()

  const add = (tag: string, text: string, parent: HTMLElement = doc.body) => {
    const node = doc.createElement(tag)
    node.textContent = text
    parent.append(node)
    return node
  }

  add('h1', book.title)
  add('p', `Loja: ${book.organizationId}`)
  add('p', `Período / Competência: ${book.periodLabel}`)
  add('p', `Plano contábil e vigência: ${book.planMetadata}`)
  add('p', `Filtros: ${book.filters || 'Nenhum'}`)
  add('p', `Registros exportados: ${book.expectedTotalCount} (Integral — Conciliado)`)
  add('p', `Gerado em: ${new Date().toLocaleString('pt-BR')}`)

  const noticeBox = add('p', `AVISO: ${book.nonFiscalNotice}`)
  noticeBox.setAttribute('data-notice', 'non-fiscal')

  if (book.reconciledTotals.length) {
    const summaryHeading = add('h2', 'Totais Conciliados')
    summaryHeading.style.fontSize = '13px'
    const summaryList = add('ul', '')
    for (const item of book.reconciledTotals) {
      const formatted = typeof item.value === 'number'
        ? item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : item.value
      add('li', `${item.label}: ${formatted}`, summaryList)
    }
  }

  const table = add('table', '')
  const head = add('thead', '', table)
  const header = add('tr', '', head)
  book.headers.forEach(value => add('th', value, header))
  const body = add('tbody', '', table)
  book.rows.forEach(values => {
    const row = add('tr', '', body)
    values.forEach(value =>
      add(
        'td',
        typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value,
        row,
      ),
    )
  })

  const style = doc.createElement('style')
  style.textContent =
    'body{font:11px Arial,sans-serif;color:#111;background:#fff;margin:20px}h1{font-size:16px;margin:0 0 8px}p{margin:3px 0}[data-notice="non-fiscal"]{border:1px solid #333;padding:6px;margin:8px 0;font-weight:bold}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #999;padding:5px;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:12mm}'
  doc.head.append(style)
  popup.focus()
  popup.print()
}
