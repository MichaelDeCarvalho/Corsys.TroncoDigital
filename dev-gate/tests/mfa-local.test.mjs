import {test} from 'node:test'
import assert from 'node:assert/strict'
import {qrDataUrl} from '../tools/mfa-local.mjs'
test('local QR preserves SVG fragments and excludes remote or HTML sources',()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M0 0"/></svg>'
 const expected='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')
 assert.equal(qrDataUrl(svg),expected)
 assert.equal(qrDataUrl('data:image/svg+xml;utf-8,'+svg),expected)
 assert.equal(qrDataUrl('data:image/svg+xml,'+encodeURIComponent(svg)),expected)
 assert.equal(qrDataUrl(expected),expected)
 for(const bad of ['https://remote.invalid/qr','<img src=x onerror=alert(1)>','javascript:alert(1)',null])assert.throws(()=>qrDataUrl(bad))
})
