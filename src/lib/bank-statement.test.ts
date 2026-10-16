import {describe,it,expect} from 'vitest'
import {parseBankStatement} from './bank-statement'
const header='data;descricao;valor;id\n'
describe('bank statement boundary',()=>{
 it('parses signed CSV, quoted descriptions and exact decimal strings',()=>{
  expect(parseBankStatement(header+'2026-09-01;"PIX; recebido";250.00;a\n2026-09-02;Tarifa;-2.50;b','a.csv').lines)
   .toEqual([{date:'2026-09-01',description:'PIX; recebido',amount:'250.00',external_id:'a'},{date:'2026-09-02',description:'Tarifa',amount:'-2.50',external_id:'b'}])
 })
 it('parses a BRL OFX transaction without executing XML',()=>{
  expect(parseBankStatement('<OFX><CURDEF>BRL<BANKTRANLIST><STMTTRN><DTPOSTED>20260901120000[-3:BRT]<TRNAMT>12.5<FITID>x<NAME>PIX</STMTTRN></BANKTRANLIST></OFX>','bank.ofx').lines[0].amount).toBe('12.50')
 })
 it.each(['0','NaN','Infinity','1.001','1,00','1000000000000','1e2'])('rejects invalid amount %s',value=>{
  expect(()=>parseBankStatement(header+'2026-09-01;PIX;'+value+';x','a.csv')).toThrow()
 })
 it('rejects invalid dates, duplicates, broken quotes and excessive rows',()=>{
  for(const body of ['2026-02-30;PIX;1;x','2026-09-01;PIX;1;x\n2026-09-02;PIX;2;x','2026-09-01;"PIX;1;x',Array.from({length:501},(_,i)=>`2026-09-01;PIX;1;${i}`).join('\n')])
   expect(()=>parseBankStatement(header+body,'a.csv')).toThrow()
 })
 it('rejects foreign currency, entities and unknown extensions',()=>{
  for(const text of ['<CURDEF>USD<BANKTRANLIST></BANKTRANLIST>','<!DOCTYPE OFX><CURDEF>BRL<BANKTRANLIST></BANKTRANLIST>'])expect(()=>parseBankStatement(text,'a.ofx')).toThrow()
  expect(()=>parseBankStatement(header+'2026-09-01;PIX;1;x','a.txt')).toThrow()
 })
})
