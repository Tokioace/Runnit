import { Link } from 'react-router-dom';
import { legalPages } from '../../lib/legalPages';
export default function LegalLinks(){
 if(!legalPages)return null;
 return <nav aria-label="Rechtliche Informationen" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-cyan-100">
  <Link className="inline-flex min-h-11 items-center underline underline-offset-4" to="/privacy">Datenschutz</Link>
  <Link className="inline-flex min-h-11 items-center underline underline-offset-4" to="/terms">Nutzungsbedingungen</Link>
  <Link className="inline-flex min-h-11 items-center underline underline-offset-4" to="/imprint">Impressum</Link>
 </nav>;
}
