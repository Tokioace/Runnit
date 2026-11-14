import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = Readonly<{ children: ReactNode }>;
type State = Readonly<{ failed: boolean }>;

/**
 * A last-resort recovery UI for React rendering/lifecycle failures.
 *
 * It deliberately does not transmit, persist, or display error details.
 * It cannot catch event-handler errors, async errors, or failed JS bundle loads.
 * Keep it outside BrowserRouter so the recovery UI does not depend on routing.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally no automatic telemetry or error-detail disclosure.
  }

  private retry = (): void => {
    this.setState({ failed: false });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main
        role="alert"
        className="flex min-h-screen items-center justify-center bg-[#080b13] px-5 py-12 text-white"
      >
        <section className="w-full max-w-md rounded-3xl border border-white/15 bg-[#111827] p-6 shadow-xl">
          <div aria-hidden="true" className="mb-4 text-4xl">⚠️</div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            Runnit
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">Ein Anzeigefehler ist aufgetreten</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Diese Ansicht konnte nicht geladen werden. Du kannst die Anzeige erneut versuchen
            oder die App neu laden.
          </p>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={this.retry}
              className="min-h-12 rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="min-h-12 rounded-xl border border-white/25 px-4 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              App neu laden
            </button>
          </div>
          <p className="mt-5 text-xs leading-5 text-white/55">
            Nicht gespeicherte Eingaben können beim Neustart verloren gehen.
            Es werden keine technischen Fehlerdaten automatisch versendet.
          </p>
        </section>
      </main>
    );
  }
}
