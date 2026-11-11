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
 * pageShow also handles opening an existing tab via back-forward cache.
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

    const onPageShow = () => {
      resetPageScrollToTop(window, document);
      const frame = window.requestAnimationFrame(() => resetPageScrollToTop(window, document));
      // A frame scheduled during pageshow normally runs; there is nothing
      // to cancel if the browser destroys this page during navigation.
      void frame;
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      try { window.history.scrollRestoration = previous; } catch { /* Browser may disallow it. */ }
    };
  }, []);

  return null;
}
