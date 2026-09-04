'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

/**
 * FingerprintButton — port of the reference HTML/CSS/JS pen.
 *
 * Behaviour mirrors the source exactly:
 *   • Button is blank at rest (prints + draw both opacity 0).
 *   • On hover, prints fade in (CSS, 0.8s ease) and each path draws in
 *     sequence via JS-set stroke-dashoffset transitions (1s per path,
 *     0.1s stagger). The GIF-pattern overlay (`.fp-draw`) follows the
 *     same stagger but starts 1s later (DRAW_OFFSET).
 *   • On hover release, the prints + draw groups fade back to opacity 0
 *     via the CSS transition on the base `.fp-prints` rule. The dashoffset
 *     stays at 0 but the opacity hides it; the next hover restarts the
 *     animation cleanly via the runAnimation reset.
 *   • An `isAnimating` ref guards against re-entry during a draw, so
 *     rapid in/out doesn't break the staggered sequence.
 *
 * Dark mode: the neumorphic palette is theme-aware. The reference uses
 * indigo `rgba(55, 84, 170, X)` for the dropped corner and pure `white`
 * for the lifted corner — pairing a cool-shadow with a warm highlight on
 * the `#f1f3f6` surface. The dark equivalent uses pure `black` for the
 * dropped corner and a soft navy `rgba(40, 60, 95, X)` for the lifted
 * corner on a `#131c2c` surface. Stroke colour and stack structure are
 * identical between modes.
 *
 * Size: scaled from the reference 120px down to 49px to fit the
 * top-right cluster. Shadow offsets/blurs are proportionally scaled
 * (~ 0.41×) so the neumorphic depth reads the same at the smaller size.
 */

const svgPaths = [
  'M13.1 52.786s4.367-1.106 4.725-10.829 4.841-22.651 9.107-25.389',
  'M28.984 14.686S40.423-.54 66.58 4.026',
  'M75.173 11.689a43.984 43.984 0 00-19.836-3.077c-9.059.522-17.207 3.674-24.463 12.261-8.447 9.995-8.456 22.215-7.789 31.5.457 6.372-7.166 9.01-9.363 9.326',
  'M82.387 84.332a4.85 4.85 0 01-1.987-3.344c-.423-2.428 1.032-9.714 2.486-13.691s3.346-12.64 3.427-16.456a32.465 32.465 0 00-.624-6.964',
  'M75.383 18.957S86.59 26.26 88.491 39',
  'M72.031 17s-19.474-9.522-35.118 4.62',
  'M34.832 24.532s-2.749 3.991-2.5 4.091',
  'M30.531 32.956s-2.172 9.127-2.224 13.506a87 87 0 01-.422 10.347c-.352 1.971-2.323 7.827-11.826 11.129',
  'M16.845 74.418s6.676-3.673 8.717-5.643',
  'M30.531 62.637a10.878 10.878 0 003.454-6.445c.751-4.334-.281-8.932 0-12.217s1.231-15.111 11.08-20.836 21.055-3.191 25.636 0 10.717 8.937 11.236 18.045a58 58 0 01-2.214 17.947',
  'M19.692 81.044s12.7-9.13 16.077-15.873 4.692-9.9 4.223-14.33-.351-12.689 2.722-17.885a17.446 17.446 0 0110.815-7.673',
  'M58.243 24.847a11.342 11.342 0 015.484.855',
  'M67.241 27.317s6.887 3.331 7.932 10.463 1.046 13.234-.643 18.02-6.224 20.672-7.289 23.851S63.976 97.159 68.83 99.1',
  'M78.178 65.209s-4.211 14.242-4.68 18.56-1.06 7.231 1.675 9.854',
  'M60.167 102.915s-2.767-3.358-2.884-10.887a31.772 31.772 0 013.732-14.923c.845-1.689 6.57-15.079 7.884-20.913s1.838-14.646.45-19.2-5.143-7-12.182-6.34S48.392 34.4 47.148 37.5s.165 9.87-.492 15.955S43 68.1 34.832 75.885 22.953 86.63 22.953 86.63',
  'M26.36 91.114s9.2-8.1 14.1-12.883 11.32-15.674 11.949-22.337-.887-11.87.117-14.71 3.046-5.468 6.049-5 5.529 1.5 5.768 7.977-3.516 17.926-3.516 17.926c-1.22 2.441-9.722 22.525-10.164 26.373',
  'M51.884 104.791s-2.1-6.2-1.974-9.762',
  'M40.274 100.944a20.083 20.083 0 010-8.916c1.1-4.97 4.412-8.916 6.335-11.638s7.537-10.418 9.658-19.522',
  'M58.34 43.109s.524 7.441-.891 13.068',
];

// Animation timing — slightly faster than the reference script (which used
// 0.1 / 1 / 1). Total reveal length: 0.6 + 17×0.06 + 0.6 ≈ 2.22s, vs. the
// reference's 3.7s — ~40% snappier without losing the staggered feel.
const STAGGER     = 0.06; // seconds between each path
const PATH_DUR    = 0.6;  // seconds per path draw
const DRAW_OFFSET = 0.6;  // seconds delay for draw group relative to prints start

// Light-mode palette tokens documented inline above. Dark-mode overrides
// use `:where(html.dark)` so they share specificity with the base rule
// and win on source order without `!important` noise.
const css = `
  .fp-btn {
    position: relative;
    width: 49px;
    height: 49px;
    background: var(--neu-surface);
    border-radius: 50%;
    box-shadow:
      inset 0 0 6px rgba(55, 84, 170, 0),
      inset 0 0 8px rgba(255, 255, 255, 0),
      5px 5px 10px rgba(55, 84, 170, 0.22),
      -5px -5px 11px rgba(255, 255, 255, 0.65),
      inset 0 0 2px rgba(255, 255, 255, 0.2);
    transition: box-shadow 0.7s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    border: none;
    font-size: 0;
    cursor: pointer;
    overflow: visible;
  }

  .fp-btn:hover,
  .fp-btn:focus-visible {
    box-shadow:
      inset 4px 4px 9px rgba(55, 84, 170, 0.18),
      inset -4px -4px 12px rgba(255, 255, 255, 0.7),
      0 0 2px rgba(255, 255, 255, 0.2);
  }

  .fp-svg {
    width: 80%;
    height: 80%;
    display: block;
    filter: drop-shadow(-1px -1px 1px rgba(55, 84, 170, 0.2));
    overflow: visible;
  }

  /* Prints fade in on hover, fade out on release (CSS transition on the
     BASE rule, so the property animates in both directions). The path
     draw itself is JS-driven via stroke-dashoffset transitions set per
     element in runAnimation. */
  .fp-prints {
    opacity: 0;
    transition: opacity ease-in-out 0.8s;
  }

  /* GIF-pattern overlay is JS-controlled for stroke-dashoffset — the
     reference's CSS transition was removed because it conflicted with the
     per-path inline transitions. Opacity is hover-only with no transition,
     so the overlay snaps in/out (per the source pen). */
  .fp-draw {
    opacity: 0;
  }

  .fp-btn:hover .fp-prints { opacity: 1; }
  .fp-btn:hover .fp-draw   { opacity: 0.4; }

  /* ── Dark-mode palette ──────────────────────────────────────────────
     The light palette uses indigo as the cool-shadow side and white as
     the warm-highlight side. The dark palette swaps these for the analog
     pair: black + soft navy, on a #131c2c surface. The shadow stack
     structure (5 layers: two zero-alpha primer insets, the dropped-corner
     offset, the lifted-corner offset, the soft inset glow) is preserved,
     so the 0.7s transition into the pressed-in hover state remains
     smooth in both themes. */
  :where(html.dark) .fp-btn {
    box-shadow:
      inset 0 0 6px rgba(0, 0, 0, 0),
      inset 0 0 8px rgba(72, 96, 130, 0),
      5px 5px 10px rgba(0, 0, 0, 0.5),
      -5px -5px 11px rgba(96, 120, 160, 0.32),
      inset 0 0 2px rgba(72, 96, 130, 0.2);
  }

  :where(html.dark) .fp-btn:hover,
  :where(html.dark) .fp-btn:focus-visible {
    box-shadow:
      inset 4px 4px 9px rgba(0, 0, 0, 0.45),
      inset -4px -4px 12px rgba(96, 120, 160, 0.3),
      0 0 2px rgba(72, 96, 130, 0.2);
  }

  :where(html.dark) .fp-svg {
    filter: drop-shadow(0 0 2px rgba(60, 160, 230, 0.18));
  }

  /* Dark-mode draw overlay — replace the rainbow GIF pattern with a
     monochrome black→grey gradient so the imprint stays in greyscale.
     The .fp-draw <g> still inherits the URL stroke; we just point it
     at a different paint server in dark mode. */
  :where(html.dark) .fp-draw {
    stroke: url(#fp-grey);
  }

  /* Dark-mode prints — soften the stark #fff stroke to a light grey so
     the imprint reads as "shade of black and grey" overall, not pure
     white-on-navy. The prints layer is the dominant one (opacity 1 on
     hover, vs. .fp-draw at 0.4), so this single override changes the
     overall colour grading of the hovered button. */
  :where(html.dark) .fp-prints {
    stroke: #b8b8b8;
  }
`;

export default function FingerprintButton() {
  const printsRefs     = useRef<(SVGPathElement | null)[]>([]);
  const drawRefs       = useRef<(SVGPathElement | null)[]>([]);
  const isAnimatingRef = useRef(false);

  // The light-mode draw stroke is a giphy.com GIF (see the <defs> below) —
  // dark mode never references it at all (its .fp-draw stroke points at
  // the local #fp-grey gradient instead, via the CSS above), but the
  // <image> tag was previously always in the DOM regardless of theme, so
  // every dashboard load fetched that GIF from a third party even for
  // dark-mode users who could never see it. Gated on resolvedTheme so it
  // also reacts correctly if the user flips the toggle without a page
  // reload (a mount-only check would miss that). resolvedTheme is
  // undefined until next-themes resolves it post-mount, so this starts
  // unrendered on both the server and the first client paint — no
  // hydration mismatch — and only turns on once we positively know the
  // theme is light.
  const { resolvedTheme } = useTheme();
  const showGifPattern = resolvedTheme === 'light';

  // Initial setup — measure each path's length and dash it out so it's
  // hidden until the first hover. Runs once after mount; refs are
  // populated by the ref callbacks before this effect fires.
  useEffect(() => {
    const all = [...printsRefs.current, ...drawRefs.current];
    all.forEach((p) => {
      if (!p) return;
      const len = p.getTotalLength();
      p.style.strokeDasharray  = String(len);
      p.style.strokeDashoffset = String(len);
    });
  }, []);

  const runAnimation = () => {
    // Guard against re-entry: if the previous animation is still running
    // (3.7s total at default timings), ignore further hovers.
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const all = [...printsRefs.current, ...drawRefs.current];

    // Reset to hidden, transition disabled — without `transition: none`
    // the dashoffset jump back to `len` would itself animate and we'd
    // see the prints "fade out" before the new draw starts.
    all.forEach((p) => {
      if (!p) return;
      p.style.transition       = 'none';
      p.style.strokeDashoffset = String(p.getTotalLength());
    });

    // Double rAF: the first frame commits the reset (`transition: none`
    // + dashoffset = len); the second frame applies the new transition
    // and target dashoffset, so the browser observes a transition delta
    // instead of merging both updates into a single non-animating change.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      printsRefs.current.forEach((p, i) => {
        if (!p) return;
        const delay = i * STAGGER;
        p.style.transition       = `stroke-dashoffset ${PATH_DUR}s linear ${delay}s`;
        p.style.strokeDashoffset = '0';
      });

      drawRefs.current.forEach((p, i) => {
        if (!p) return;
        const delay = DRAW_OFFSET + i * STAGGER;
        p.style.transition       = `stroke-dashoffset ${PATH_DUR}s linear ${delay}s`;
        p.style.strokeDashoffset = '0';
      });

      // Release the guard after the last path finishes drawing.
      const totalMs =
        (DRAW_OFFSET + (drawRefs.current.length - 1) * STAGGER + PATH_DUR) * 1000;
      setTimeout(() => { isAnimatingRef.current = false; }, totalMs);
    }));
  };

  return (
    <>
      <style>{css}</style>
      <button
        className="fp-btn"
        type="button"
        onMouseEnter={runAnimation}
        aria-label="Press to scan fingerprint"
      >
        <svg
          className="fp-svg"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 103.051 102"
        >
          <defs>
            {/* Light-mode draw stroke — rainbow giphy GIF, per the reference */}
            <pattern
              id="fp-gif"
              height="100%"
              width="100%"
              patternContentUnits="objectBoundingBox"
            >
              {showGifPattern && (
                <image
                  height="1"
                  width="1"
                  preserveAspectRatio="none"
                  href="https://media.giphy.com/media/dAWZiSMbMvObDWP3aA/giphy.gif"
                />
              )}
            </pattern>

            {/* Dark-mode draw stroke — black → grey diagonal gradient.
                Activated by the `:where(html.dark) .fp-draw` rule above
                pointing the stroke at this gradient instead of #fp-gif. */}
            <linearGradient id="fp-grey" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#2a2a2a" />
              <stop offset="50%"  stopColor="#7a7a7a" />
              <stop offset="100%" stopColor="#cccccc" />
            </linearGradient>
          </defs>

          {/* Prints layer — white outlines, fades in on hover */}
          <g className="fp-prints" stroke="#fff">
            {svgPaths.map((d, i) => (
              <path
                key={`prints-${i}`}
                ref={(el) => { printsRefs.current[i] = el; }}
                fill="none"
                strokeLinecap="round"
                strokeMiterlimit="10"
                strokeWidth="2"
                d={d}
              />
            ))}
          </g>

          {/* Draw layer — GIF-pattern stroke, snaps to 0.4 opacity on hover */}
          <g className="fp-draw" stroke="url(#fp-gif)">
            {svgPaths.map((d, i) => (
              <path
                key={`draw-${i}`}
                ref={(el) => { drawRefs.current[i] = el; }}
                fill="none"
                strokeLinecap="round"
                strokeMiterlimit="10"
                strokeWidth="2"
                d={d}
              />
            ))}
          </g>
        </svg>
      </button>
    </>
  );
}
