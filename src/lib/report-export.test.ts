// @vitest-environment node
import { unzipSync, strFromU8 } from 'fflate'
import {
  createIntegralBookWorkbook,
  createReportWorkbook,
  validateIntegralBookExport,
  validateReport,
  type IntegralBookExport,
  type ReportSnapshot,
} from './report-export'

const report: ReportSnapshot = {
  title: 'Recebimentos', organizationId: 'org-1', scope: 'Somente página 2', filters: '2026-11',
  headers: ['Descrição', 'Valor'], rows: [['=HYPERLINK("https://example.test")', 1234.56], ['<script>alert(1)</script>', -12.5]],
}

const integralBook: IntegralBookExport = {
  title: 'Diário Contábil Integral',
  bookType: 'DIARIO',
  organizationId: 'org-1',
  periodLabel: '2026-10-01 a 2026-10-31',
  planMetadata: 'Plano 2026 (2026-01 a 2026-12)',
  filters: 'Base: event_date',
  expectedTotalCount: 2,
  integralOk: true,
  incompleteReasons: [],
  reconciledTotals: [
    { label: 'Total Débito', value: 250 },
    { label: 'Total Crédito', value: 250 },
  ],
  nonFiscalNotice: 'Diário Gerencial auxiliar — não substitui livro diário oficial elaborado pelo contador.',
  headers: ['Seq', 'Histórico', 'Valor'],
  rows: [
    [1, '=CMD("evil")', 150],
    [2, 'Recebimento <b>1</b>', 100],
  ],
}

describe('local XLSX report generation', () => {
  it('writes a real workbook with numeric money, literal untrusted text and scope metadata', async () => {
    const blob = await createReportWorkbook(report)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(files['[Content_Types].xml']).toBeDefined()
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    const allXml = Object.values(files).map(value => strFromU8(value)).join('')
    expect(sheet).toContain('1234.56')
    expect(sheet).toContain('-12.5')
    expect(allXml).toContain('Somente página 2')
    expect(allXml).toContain('HYPERLINK')
    expect(sheet).not.toMatch(/<f[ >]/)
    expect(allXml).not.toContain('<script>')
  })
  it('rejects invalid values and incomplete tables instead of writing a partial export', async () => {
    expect(() => validateReport({ ...report, organizationId: '' })).toThrow()
    await expect(createReportWorkbook({ ...report, rows: [['x', NaN]] })).rejects.toThrow()
    await expect(createReportWorkbook({ ...report, rows: [['x']] })).rejects.toThrow()
  })

  it('writes two-sheet integral workbook with metadata, non-fiscal disclaimer, and formula-safe literal cells', async () => {
    const blob = await createIntegralBookWorkbook(integralBook)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(files['xl/worksheets/sheet1.xml']).toBeDefined()
    expect(files['xl/worksheets/sheet2.xml']).toBeDefined()
    const allXml = Object.values(files).map(v => strFromU8(v)).join('')
    expect(allXml).toContain('Resumo e Concilia')
    expect(allXml).toContain('CONCILIADO / INTEGRAL')
    expect(allXml).toContain('CMD')
    expect(allXml).not.toMatch(/<f[ >]/)
    expect(allXml).not.toContain('<b>')
  })

  it('blocks integral export when incomplete, truncated, or missing mandatory non-fiscal disclaimer', async () => {
    expect(() => validateIntegralBookExport({ ...integralBook, integralOk: false })).toThrow(/bloqueada/i)
    expect(() => validateIntegralBookExport({ ...integralBook, expectedTotalCount: 3 })).toThrow(/incompleto/i)
    await expect(createIntegralBookWorkbook({ ...integralBook, nonFiscalNotice: 'aviso simples' })).rejects.toThrow(/gerencial\/não fiscal/i)
  })
})
