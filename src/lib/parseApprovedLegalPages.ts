export type LegalPage = Readonly<{title:string; sections:readonly Readonly<{heading:string;body:string}>[]}>;
export type LegalPages = Readonly<{version:string; privacy:LegalPage; terms:LegalPage; imprint:LegalPage}>;
const placeholder = /\[\s*(?:TODO|OFFEN|PLATZHALTER|EINTRAGEN|BESTÄTIGEN)\b|\bexample\.(?:com|org|net)\b/i;
function validText(value: unknown,max: number): value is string {
 return typeof value==='string' && value.trim().length>0 && value.length<=max && !placeholder.test(value);
}
/** Structural gate only; legal content needs independent operator approval.
 * A failed or incomplete configuration must never publish template text. */
export function parseApprovedLegalPages(raw:unknown, enabled:unknown): LegalPages | null {
 if(enabled!=='true'||typeof raw!=='string'||raw.length>150000)return null;
 try {
  const value=JSON.parse(raw);
  if(!value||!validText(value.version,80))return null;
  const pages:Partial<Record<'privacy'|'terms'|'imprint',LegalPage>>={};
  for(const key of ['privacy','terms','imprint'] as const){
   const p=value[key];
   if(!p||!validText(p.title,120)||!Array.isArray(p.sections)||p.sections.length===0||p.sections.length>50)return null;
   const sections: {heading:string;body:string}[]=[];
   for(const section of p.sections){
    if(!section||!validText(section.heading,180)||!validText(section.body,20000))return null;
    sections.push({heading:section.heading.trim(),body:section.body.trim()});
   }
   pages[key]={title:p.title.trim(),sections};
  }
  return {version:value.version.trim(),privacy:pages.privacy!,terms:pages.terms!,imprint:pages.imprint!};
 }catch{return null;}
}

/** Fail the build rather than silently omit explicitly enabled legal pages. */
export function assertLegalBuildConfiguration(raw:unknown, enabled:unknown): void {
 if(enabled==='true'&&!parseApprovedLegalPages(raw,enabled)){
  throw new Error('Enabled legal pages require valid approved privacy, terms and imprint configuration.');
 }
}
