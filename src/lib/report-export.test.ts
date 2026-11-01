// @vitest-environment node
import { unzipSync, strFromU8 } from 'fflate'
import { createReportWorkbook, validateReport, type ReportSnapshot } from './report-export'

const report: ReportSnapshot = {
  title: 'Recebimentos', organizationId: 'org-1', scope: 'Somente página 2', filters: '2026-11',
  headers: ['Descrição', 'Valor'], rows: [['=HYPERLINK("https://example.test")', 1234.56], ['<script>alert(1)</script>', -12.5]],
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
})
