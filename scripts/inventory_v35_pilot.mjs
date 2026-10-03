import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
// Static parsing only: no runScripts, resources, fetch or evaluation.
const require=createRequire(new URL('../package.json', import.meta.url));
const {JSDOM}=require('jsdom');const ts=require('typescript');
const src=process.argv[2];
const output=process.argv[3];
if(!src||!output) throw new Error('Usage: node scripts/inventory_v35_pilot.mjs SOURCE.html OUTPUT.json');
const html=fs.readFileSync(src,'utf8');
const dom=new JSDOM(html,{includeNodeLocations:true});const doc=dom.window.document;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
function items(root){
 const label=e=>clean(e.getAttribute('aria-label')||e.labels?.[0]?.textContent||e.closest('label')?.textContent||e.closest('.form-group')?.querySelector('label')?.textContent||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.id||e.name||'Sem rótulo explícito');
 const attrs=e=>Object.fromEntries([...e.attributes].filter(a=>/^(id|name|class|title|inputmode|type|value|placeholder|hidden|href|tabindex|autocomplete|disabled|required|readonly|min|max|step|maxlength|accept|multiple|checked|data-|aria-)/.test(a.name)).map(a=>[a.name,a.value]));
 return {
  display_labels:[...root.querySelectorAll('.label,.compact-stat small,.stat small,.kpi-label,.metric-label,.card>strong,.structure-rule>b,.plan-status-box small,.hero p,.section-title>span')].map(e=>clean(e.textContent)),
  headings:[...root.querySelectorAll('h1,h2,h3,h4')].map(e=>clean(e.textContent)),
  fields:[...root.querySelectorAll('input,select,textarea')].map(e=>({label:label(e),tag:e.tagName.toLowerCase(),attributes:attrs(e),options:[...e.querySelectorAll('option')].map(o=>({text:clean(o.textContent),value:o.getAttribute('value'),selected:o.hasAttribute('selected')})),text:e.tagName==='TEXTAREA'?clean(e.textContent):undefined})),
  actions:[...root.querySelectorAll('button,a,.quick-action,[data-jump],[data-modal],[data-report],[data-member],[role=button]')].map(e=>({label:clean(e.textContent)||e.getAttribute('aria-label')||e.getAttribute('title')||'Sem texto',attributes:attrs(e)})),
  tabs:[...root.querySelectorAll('button[data-tab],button[data-plan-tab],button[data-dre-tab],button[data-client-tab],button[data-operation-tab],button[data-structure-pane],button[data-mode],[role=tab],.tab-btn,.plan-tab,.client360-tab')].map(e=>({label:clean(e.textContent),attributes:attrs(e)})),
  tables:[...root.querySelectorAll('table')].map(e=>({id:e.id,row_headers:[...e.querySelectorAll('tbody th')].map(x=>clean(x.textContent)),headers:[...e.querySelectorAll('thead th')].map(x=>clean(x.textContent))})),
  notes:[...root.querySelectorAll('.callout,.saas-note,.edit-history-note,.v33-security-note,.published-lock,.plan-source-note,.auto-class-note,.hint,.note,.billing-warning')].map(e=>clean(e.textContent)).filter(Boolean)
 };
}
const sections=[...doc.querySelectorAll('.view[id]')].map(e=>({id:e.id,line:dom.nodeLocation(e)?.startLine,...items(e)}));
const shared=items(doc.body.cloneNode(true));
// Remove top-level views before inventorying shared drawers/dialogs/navigation.
const sharedRoot=doc.body.cloneNode(true);sharedRoot.querySelectorAll('.view[id],script').forEach(e=>e.remove());
const fragments=[],functions=[],handlers=[];
function reconstruct(n){
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
 if(ts.isTemplateExpression(n))return n.head.text+n.templateSpans.map((s,i)=>`__EXPR_${i}__`+s.literal.text).join('');
 if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken)return reconstruct(n.left)+reconstruct(n.right);
 return '__EXPRESSION__';
}
for(const script of doc.querySelectorAll('script:not([src])')){
 const code=script.textContent;const source=ts.createSourceFile(script.id||'inline.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const base=dom.nodeLocation(script)?.startLine||1;
 function context(node){const names=[];for(let p=node.parent;p;p=p.parent){if(ts.isFunctionDeclaration(p)&&p.name)names.push(p.name.text);if(ts.isVariableDeclaration(p))names.push(p.name.getText(source));if(ts.isPropertyAssignment(p))names.push(p.name.getText(source));if(ts.isObjectLiteralExpression(p)){for(const prop of p.properties){if(ts.isPropertyAssignment(prop)&&['mode','title'].includes(prop.name.getText(source))&&ts.isStringLiteral(prop.initializer))names.push(prop.initializer.text)}}}return [...new Set(names)].reverse().join(' / ')||script.id||'inline';}
 function walk(node){
  const line=base+source.getLineAndCharacterOfPosition(node.getStart(source)).line;
  if(ts.isFunctionDeclaration(node)&&node.name)functions.push({name:node.name.text,line,module:script.id||'inline'});
  if(ts.isCallExpression(node)&&/addEventListener$/.test(node.expression.getText(source)))handlers.push({line,event:node.arguments[0]?.getText(source),context:context(node),selector:node.expression.getText(source)});
  let markup;
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken&&!(ts.isBinaryExpression(node.parent)&&node.parent.operatorToken.kind===ts.SyntaxKind.PlusToken))markup=reconstruct(node);
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))markup=node.text;
  else if(ts.isTemplateExpression(node))markup=node.head.text+node.templateSpans.map((s,i)=>`__EXPR_${i}__`+s.literal.text).join('');
  if(markup&&/<(?:input|select|textarea|button|table|h[1-4]|div|label|section)\b/i.test(markup)){
    const frag=new JSDOM('<body>'+markup+'</body>');const parsed=items(frag.window.document.body);
    fragments.push({id:'DYN-'+String(fragments.length+1).padStart(3,'0'),line,context:context(node),...parsed});
  }
  ts.forEachChild(node,walk);
 }
 walk(source);
}
const out={source:{name:src.split('/').at(-1),sha256:crypto.createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),lines:html.split('\n').length,browser_execution:'BLOCKED: cloud browser cannot open localhost or file protocol; static analysis only.'},contexts:[...doc.querySelector('#accessContextSelect').options].map(e=>({value:e.value,label:clean(e.textContent)})),sections,shared:items(sharedRoot),fragments,functions,handlers};
fs.writeFileSync(output,JSON.stringify(out,null,2));
console.log(JSON.stringify({screens:sections.map(s=>({id:s.id,headings:s.headings,fields:s.fields.length,actions:s.actions.length,tables:s.tables.length,tabs:s.tabs.length})),dynamic_fragments:fragments.length,dynamic_fields:fragments.reduce((n,f)=>n+f.fields.length,0),functions:functions.length,handlers:handlers.length,contexts:out.contexts},null,2));
