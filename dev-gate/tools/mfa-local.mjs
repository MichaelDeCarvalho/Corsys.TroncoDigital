// SVG is embedded as an image data URL, never raw HTML or a remote resource.
export function qrDataUrl(qr) {
 if(typeof qr!=='string')throw Error('Missing QR SVG')
 let svg=qr
 if(qr.startsWith('data:image/svg+xml')) {
  const comma=qr.indexOf(',');if(comma<0)throw Error('Malformed SVG data URL')
  const header=qr.slice(0,comma),body=qr.slice(comma+1)
  if(header.includes(';base64'))svg=Buffer.from(body,'base64').toString('utf8')
  else {try{svg=decodeURIComponent(body)}catch{svg=body}}
 }
 if(!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg))throw Error('Only local SVG QR accepted')
 return 'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')
}
