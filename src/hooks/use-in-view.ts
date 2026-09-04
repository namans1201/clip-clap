'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * True once the observed element has entered the viewport (or come within
 * `rootMargin` of it) — and stays true forever after. This is a
 * render-once gate, not a continuous visibility toggle: scrolling a card
 * out of view and back shouldn't re-trigger the (potentially expensive)
 * content it gated.
 *
 * Returns a callback ref rather than a RefObject so the same hook works
 * whichever element type the caller attaches it to.
 */
export function useInView(rootMargin = '400px') {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: Element | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || inView) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observerRef.current?.disconnect();
          }
        },
        { rootMargin },
      );
      observerRef.current.observe(node);
    },
    [inView, rootMargin],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, inView };
}
