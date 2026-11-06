import { useEffect, useRef } from "react";

/**
 * Phone back button / swipe-back support.
 * Every "inner" screen (sheet, drawer, Overview, Summary, Review, a non-Home tab) registers as a layer.
 * One browser-history entry is kept per open layer, so Back closes the top layer instead of leaving the app.
 */
interface Layer { close: () => void; closing: boolean }
const stack: Layer[] = [];
let histDepth = 0;          // history entries we have pushed that still exist
let pending = false;        // a history.go() we started is still travelling
let started = false;

const live = () => stack.filter((l) => !l.closing).length;

function reconcile() {
  if (pending) return;
  const want = live();
  if (histDepth < want) {
    for (let i = histDepth + 1; i <= want; i++) history.pushState({ kharcha: i }, "");
    histDepth = want;
  } else if (histDepth > want) {
    pending = true;
    history.go(want - histDepth);
    window.setTimeout(() => { if (pending) { pending = false; histDepth = (history.state?.kharcha as number | undefined) ?? 0; reconcile(); } }, 600);
  }
}

function start() {
  if (started) return;
  started = true;
  history.replaceState({ kharcha: 0 }, "");
  window.addEventListener("popstate", (e) => {
    const depth = (e.state?.kharcha as number | undefined) ?? 0;
    histDepth = depth;
    if (pending) { pending = false; reconcile(); return; }
    // the user pressed Back: close layers from the top until the stack matches the history depth
    const open = stack.filter((l) => !l.closing);
    for (let i = open.length - 1; i >= depth; i--) { open[i].closing = true; open[i].close(); }
    reconcile();
  });
}

/** While `active` is true, the Back button calls `close` instead of leaving the app. */
export function useBackLayer(active: boolean, close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!active) return;
    start();
    const layer: Layer = { close: () => ref.current(), closing: false };
    stack.push(layer);
    reconcile();
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
      reconcile();
    };
  }, [active]);
}
