import type { MouseEvent } from 'react'

/**
 * Client-side navigation for the AOI single-page app.
 * Updates the URL with the History API and notifies listeners via `popstate`,
 * so React can re-render without a full page reload.
 */
export function navigate(path: string): void {
  if (path === window.location.pathname) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Spreadable props for an <a> that navigates client-side while keeping a real
 * href (so middle-click / cmd-click / SEO still work).
 */
export function linkProps(path: string) {
  return {
    href: path,
    onClick: (event: MouseEvent) => {
      // Let the browser handle modified clicks (new tab, etc.).
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      event.preventDefault()
      navigate(path)
    },
  }
}
