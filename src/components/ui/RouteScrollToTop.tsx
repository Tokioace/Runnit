import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resetPageScrollToTop } from '../../lib/pageScroll';

/**
 * Central route-level scroll policy: every page opens at its heading.
 *
 * The main PageFrame uses document scrolling, rather than an independent
 * overflow container. This must live directly inside BrowserRouter so it
 * also runs when App shows its loading/login state or returns from a callback.
 *
 * The extra animation frame covers mobile Safari's delayed layout updates.
 * pageshow also handles back-forward cache; visibilitychange covers returning
 * to the open iPhone PWA from another app.
 */
export default function RouteScrollToTop() {
  const { pathname, key } = useLocation();

  useLayoutEffect(() => {
    const reset = () => resetPageScrollToTop(window, document);
    reset();
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, key]);

  useEffect(() => {
    // Browser history's automatic restoration can override a SPA navigation
    // on iOS Safari; the desired Runnit policy is always start of new page.
    const previous = window.history.scrollRestoration;
    try { window.history.scrollRestoration = 'manual'; } catch { /* Browser may disallow it. */ }

    let pageShowFrame: number | null = null;
    const onPageShow = () => {
      resetPageScrollToTop(window, document);
      if (pageShowFrame !== null) window.cancelAnimationFrame(pageShowFrame);
      pageShowFrame = window.requestAnimationFrame(() => {
        pageShowFrame = null;
        resetPageScrollToTop(window, document);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onPageShow();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
      if (pageShowFrame !== null) window.cancelAnimationFrame(pageShowFrame);
      try { window.history.scrollRestoration = previous; } catch { /* Browser may disallow it. */ }
    };
  }, []);

  return null;
}
