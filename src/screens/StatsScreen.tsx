import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, ChevronRight, Flag, Footprints, Gauge, MapPin, Ruler, ShieldCheck, Timer, Trophy, Zap } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';

// Independent statistics screen. No synthetic activity may be displayed as actual
// steps, calories, route length, personal bests, wins or official ranks.
const weekly = [
  { title: 'SCHRITTE', unit: '', icon: Footprints, tone: 'cyan' },
  { title: 'DISTANZ', unit: 'km', icon: MapPin, tone: 'lime' },
  { title: 'KALORIEN', unit: 'kcal', icon: Zap, tone: 'pink' },
] as const;

const records = [
  { title: 'BESTZEIT 50 M', icon: Timer },
  { title: 'BESTZEIT 100 M', icon: Gauge },
  { title: 'VERIFIZIERTE RENNEN', icon: Flag },
  { title: 'BESTÄTIGTE SIEGE', icon: Trophy },
] as const;

export default function StatsScreen() {
  return (
    <main className="runnit-game-home runnit-stats-screen relative min-h-[100dvh] w-full max-w-full overflow-x-clip text-white">
      <div className="runnit-game-content relative z-10 mx-auto w-full max-w-[680px] space-y-4 px-3 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-5">
        <header className="runnit-stats-hero">
          <div className="flex items-center justify-between gap-3">
            <Link to="/home" className="runnit-stats-back" aria-label="Zurück zu Home"><ChevronRight className="h-6 w-6 rotate-180" aria-hidden="true" /></Link>
            <span className="runnit-stats-brand" aria-label="RUNNIT">RUNNIT<span>▦</span></span>
            <span className="runnit-stats-beta">BETA / 00</span>
          </div>
          <div className="mt-9">
            <p className="runnit-stats-kicker">DEINE LEISTUNG / DEIN WEG</p>
            <h1>DEINE <span>STATS.</span></h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-cyan-100/80">Hier entsteht deine persönliche Laufbilanz. Bis zur geprüften Datenanbindung bleiben ungemessene Werte bewusst leer.</p>
          </div>
        </header>

        <section className="runnit-game-panel runnit-stats-overview" aria-labelledby="weekly-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="weekly-title" className="runnit-stats-heading">WOCHENFORTSCHRITT <span aria-hidden="true">///</span></h2>
            <span className="runnit-stats-period">DIESE WOCHE</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {weekly.map(({ title, unit, icon: Icon, tone }) => (
              <div key={title} className="runnit-stats-gauge-wrap">
                <div className={'runnit-stats-gauge runnit-stats-' + tone}>
                  <div className="runnit-stats-gauge-core">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <strong>—</strong>
                    <span>{unit || 'SCHRITTE'}</span>
                  </div>
                </div>
                <h3>{title}</h3>
                <p>NOCH KEINE DATEN</p>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-lg border border-cyan-300/20 bg-[#0b1c3b]/75 px-3 py-2 text-[11px] leading-5 text-cyan-100/75">
            Der Geh-Test ist ein Diagnoselabor und zählt noch nicht automatisch zu deinen Wochenwerten.
          </p>
        </section>

        <section className="runnit-game-panel runnit-stats-records" aria-labelledby="records-title">
          <h2 id="records-title" className="runnit-stats-heading">DEINE <span>BESTWERTE</span></h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {records.map(({ title, icon: Icon }) => (
              <div className="runnit-stats-record" key={title}>
                <Icon className="h-6 w-6 shrink-0 text-cyan-200" aria-hidden="true" />
                <div className="min-w-0"><h3>{title}</h3><strong>—</strong><p>NICHT VERIFIZIERT</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="runnit-game-panel runnit-stats-tools" aria-labelledby="tools-title">
          <h2 id="tools-title" className="runnit-stats-heading">TRAINING <span>& TESTS</span></h2>
          <p className="mb-3 mt-2 text-xs leading-5 text-cyan-100/70">Echte Messungen getrennt von offiziellen Ergebnissen ausprobieren.</p>
          <div className="space-y-2">
            <Link to="/gps-lab" className="runnit-stats-action"><Footprints className="h-5 w-5" aria-hidden="true" /><span>GEH-EINZELLAUF</span><ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
            <Link to="/gps-field-test" className="runnit-stats-action"><Activity className="h-5 w-5" aria-hidden="true" /><span>GPS-FELDTEST</span><ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
            <Link to="/calibration" className="runnit-stats-action"><Ruler className="h-5 w-5" aria-hidden="true" /><span>SCHRITTLÄNGE KALIBRIEREN</span><ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
          </div>
        </section>

        <Link to="/map" className="runnit-game-start group" aria-label="Zur Karte und Rennen erkunden"><BarChart3 aria-hidden="true" /><span>RENNEN ENTDECKEN</span><ArrowRight aria-hidden="true" /></Link>
        <p className="flex items-start gap-2 text-[10px] leading-5 text-cyan-100/70"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />Noch keine zertifizierten Sportwerte. Keine simulierten Ergebnisse in deiner persönlichen Statistik.</p>
      </div>
      <BottomNav />
    </main>
  );
}
