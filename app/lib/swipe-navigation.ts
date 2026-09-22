import { useEffect, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router";

// A deliberate horizontal flick: far enough sideways, not much vertical
// drift (that's a scroll), and quick.
const MIN_DISTANCE = 60;
const MAX_DRIFT = 50;
const MAX_MS = 600;

/** The nearest ancestor that scrolls sideways itself (e.g. the filter row). */
function insideHorizontalScroller(target: EventTarget | null): boolean {
  for (let el = target as HTMLElement | null; el; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === "auto" || overflow === "scroll") return true;
    }
  }
  return false;
}

/**
 * Swipe left/right anywhere in `container` to move between the mobile
 * bottom-nav pages, in the order given. Only active on touch screens, and
 * ignored when the swipe starts on something with its own horizontal
 * behaviour: a sideways-scrolling row, a form field, or an open overlay.
 */
export function useSwipeNavigation(
  container: RefObject<HTMLElement | null>,
  pages: string[],
): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const el = container.current;
    if (!el || !matchMedia("(pointer: coarse)").matches) return;

    const index = pages.findIndex((href) => pathname.startsWith(href));
    if (index === -1) return;

    let start: { x: number; y: number; at: number } | null = null;

    function onTouchStart(event: TouchEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.touches.length !== 1 ||
        target?.closest("input, textarea, select, .fixed") ||
        insideHorizontalScroller(target)
      ) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    }

    function onTouchEnd(event: TouchEvent) {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const elapsed = Date.now() - start.at;
      start = null;

      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dy) > MAX_DRIFT || elapsed > MAX_MS) return;

      // Swiping left reveals the page to the right.
      const next = pages[index + (dx < 0 ? 1 : -1)];
      if (next) navigate(next);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [container, pages, pathname, navigate]);
}
