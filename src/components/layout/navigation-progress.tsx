"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** True while a page's loading placeholders (loading.tsx, marked `data-page-loading`) are on screen. */
export function isPageLoading() {
  return typeof document !== "undefined" && document.querySelector("[data-page-loading]") !== null;
}

/** Re-renders when loading placeholders appear or disappear. */
export function usePageLoading() {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const update = () => setLoading(isPageLoading());
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return loading;
}

/**
 * A thin crimson bar along the top of the page while the next page loads, so a click always
 * answers straight away. It starts on any click on an internal link and finishes when the
 * address changes. Pages that answer instantly finish before the bar is ever shown.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const running = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (trickle.current) clearInterval(trickle.current);
    trickle.current = null;
  };

  // The address changed. If the page's loading placeholders are showing, its data is still on the
  // way: keep the bar going until they're replaced. Then finish the bar and fade it out.
  useEffect(() => {
    if (!running.current) return;
    const finish = () => {
      clear();
      running.current = false;
      setWidth(100);
      timers.current.push(setTimeout(() => setVisible(false), 200));
      timers.current.push(setTimeout(() => setWidth(0), 450));
    };
    if (!isPageLoading()) {
      finish();
      return clear;
    }
    const observer = new MutationObserver(() => {
      if (!isPageLoading()) {
        observer.disconnect();
        finish();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // PDFs and CSV files open or download outside the app.
      if (/\/(pdf|export)(\/|$)/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      clear();
      running.current = true;
      // Wait a moment: quick pages arrive before the bar would appear.
      timers.current.push(
        setTimeout(() => {
          if (!running.current) return;
          setWidth(15);
          setVisible(true);
          trickle.current = setInterval(() => setWidth((w) => (w >= 90 ? w : w + (90 - w) * 0.1)), 200);
        }, 100),
      );
      // Never hang: if something goes wrong, give up quietly.
      timers.current.push(
        setTimeout(() => {
          running.current = false;
          setVisible(false);
          setWidth(0);
        }, 20_000),
      );
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className="h-full rounded-r-full bg-brand-500 shadow-[0_0_10px_var(--color-brand-500)] motion-safe:transition-[width,opacity] motion-safe:duration-200 motion-safe:ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
