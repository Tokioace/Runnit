import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseApprovedLegalPages} from '../src/lib/parseApprovedLegalPages.ts';
const page={title:'Test',sections:[{heading:'Testabschnitt',body:'Nur Testdaten.'}]};
const fixture={version:'2026-11-25',privacy:page,terms:page,imprint:page};
test('legal pages require explicit activation and all three documents',()=>{
 assert.equal(parseApprovedLegalPages(JSON.stringify(fixture),'false'),null);
 assert.equal(parseApprovedLegalPages(JSON.stringify({...fixture,imprint:null}),'true'),null);
 assert.equal(parseApprovedLegalPages('broken','true'),null);
 assert.equal(parseApprovedLegalPages(JSON.stringify(fixture),'true').version,'2026-11-25');
});
test('unfilled fields and malformed sections cannot publish',()=>{
 for(const bad of [{...page,sections:[{heading:'Kontakt',body:'[OFFEN: Adresse]'}]},{...page,sections:[]},{...page,sections:[{heading:'Kontakt',body:'example.com'}]}]){
  assert.equal(parseApprovedLegalPages(JSON.stringify({...fixture,privacy:bad}),'true'),null);
 }
});
test('legal routes precede auth loading and use plain React text',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../src/screens/LegalScreen.tsx',import.meta.url),'utf8');
 assert.ok(app.indexOf("location.pathname === '/privacy'")<app.indexOf('if (auth.loading) {'));
 assert.doesNotMatch(screen,/dangerouslySetInnerHTML/);
});
