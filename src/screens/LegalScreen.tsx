import { Link } from 'react-router-dom';
import type { LegalPages } from '../lib/parseApprovedLegalPages';
import LegalLinks from '../components/legal/LegalLinks';
export default function LegalScreen({pages,page}:{pages:LegalPages;page:'privacy'|'terms'|'imprint'}){
 const content=pages[page];
 return <main className="min-h-[100dvh] bg-[#090b13] px-5 py-8 text-white">
  <article className="mx-auto max-w-2xl space-y-6">
   <Link to="/" className="inline-flex min-h-11 items-center text-sm font-bold text-cyan-200 underline underline-offset-4">← RUNNIT</Link>
   <header><p className="text-xs font-semibold tracking-widest text-cyan-200">RUNNIT · RECHTLICHE INFORMATIONEN</p>
    <h1 className="mt-3 break-words text-3xl font-black">{content.title}</h1>
    <p className="mt-2 text-xs text-white/60">Stand: {pages.version}</p>
   </header>
   {content.sections.map((section,i)=><section key={i} className="space-y-2">
    <h2 className="text-lg font-bold text-white">{section.heading}</h2>
    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/80">{section.body}</p>
   </section>)}
   <LegalLinks />
  </article>
 </main>;
}
