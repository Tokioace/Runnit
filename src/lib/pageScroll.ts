/**
 * Only reset the document viewport, never scrollable map controls, dialogs or
 * in-page lab result panels. Dependency-injected for browser-free regression tests.
 */
export type PageScrollWindow = {
  scrollTo: (x: number, y: number) => void;
};
export type PageScrollDocument = {
  scrollingElement?: { scrollTop: number; scrollLeft: number } | null;
  documentElement?: { scrollTop: number; scrollLeft: number } | null;
  body?: { scrollTop: number; scrollLeft: number } | null;
};

export function resetPageScrollToTop(view: PageScrollWindow, page: PageScrollDocument): void {
  // documentElement and body are both set as a cross-browser fallback:
  // on mobile Safari, the scrolling element can differ across navigation modes.
  view.scrollTo(0, 0);
  for (const element of [page.scrollingElement, page.documentElement, page.body]) {
    if (!element) continue;
    element.scrollTop = 0;
    element.scrollLeft = 0;
  }
}
