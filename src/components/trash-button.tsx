'use client';

import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function TrashButton({ onClick }: { onClick?: () => void }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';
  const isActive = pathname === '/trash';

  return (
    <>
      <Link href="/trash" className={`trash-button ${isActive ? 'active' : ''}`} onClick={onClick}>
        <span className="button__text">Trash</span>
        <span className="button__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width={512} viewBox="0 0 512 512" height={512} className="svg">
            <title />
            <path style={{ fill: 'none', stroke: isDark ? '#fff' : '#323232', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 32 }} d="M112,112l20,320c.95,18.49,14.4,32,32,32H348c17.67,0,30.87-13.51,32-32l20-320" />
            <line y2={112} y1={112} x2={432} x1={80} style={{ stroke: isDark ? '#fff' : '#323232', strokeLinecap: 'round', strokeMiterlimit: 10, strokeWidth: 32 }} />
            <path style={{ fill: 'none', stroke: isDark ? '#fff' : '#323232', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 32 }} d="M192,112V72h0a23.93,23.93,0,0,1,24-24h80a23.93,23.93,0,0,1,24,24h0v40" />
            <line y2={400} y1={176} x2={256} x1={256} style={{ fill: 'none', stroke: isDark ? '#fff' : '#323232', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 32 }} />
            <line y2={400} y1={176} x2={192} x1={184} style={{ fill: 'none', stroke: isDark ? '#fff' : '#323232', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 32 }} />
            <line y2={400} y1={176} x2={320} x1={328} style={{ fill: 'none', stroke: isDark ? '#fff' : '#323232', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 32 }} />
          </svg>
        </span>
      </Link>
      <style dangerouslySetInnerHTML={{__html: `
        .trash-button {
          --main-focus: #2d8cf0;
          --font-color: ${isDark ? '#dedede' : '#323232'};
          --bg-color-sub: ${isDark ? 'rgba(72, 96, 130, 0.32)' : 'rgba(180, 195, 220, 0.55)'};
          --bg-color: var(--neu-surface);
          --main-color: ${isDark ? '#dedede' : '#323232'};
          position: relative;
          width: 100%;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          border: none;
          /* Neumorphic shadow tuned for --neu-surface (mid-gradient tone of
             the sidebar). Same palette as the fingerprint button so the two
             bottom-row controls read as one set. The previous version used
             pure-white lift on a too-light surface and created a halo —
             pulled both the offset and the alpha down so the bevel is
             present but quiet. */
          box-shadow:
            5px 5px 10px ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(55, 84, 170, 0.22)'},
            -5px -5px 11px ${isDark ? 'rgba(96, 120, 160, 0.32)' : 'rgba(255, 255, 255, 0.7)'},
            inset 0 0 2px ${isDark ? 'rgba(72, 96, 130, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
          background-color: var(--bg-color);
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.25s ease, transform 0.18s ease;
          text-decoration: none;
        }

        .trash-button.active {
          background: var(--bg-color-sub);
        }

        .trash-button .button__text {
          /* Center within the full button width. The original design used
             translateX(33px) to leave room for an always-visible left-side
             icon — now that the icon only appears as a hover slide-in, the
             label should sit in the centre instead of biased left. */
          flex: 1;
          text-align: center;
          color: var(--font-color);
          font-family: var(--font-sans);
          font-weight: 600;
          transition: color 0.15s ease;
        }

        .trash-button .button__icon {
          position: absolute;
          transform: translateX(calc(100% + 50px));
          height: 100%;
          width: 39px;
          background-color: var(--bg-color-sub);
          display: flex;
          align-items: center;
          justify-content: center;
          /* Smooth slide-in instead of an instant snap. width + transform
             animate together so the strip both grows and slides over the
             label in one motion. */
          transition: width 0.28s ease, transform 0.28s ease;
          right: 0;
        }

        .trash-button .svg {
          width: 20px;
          fill: var(--main-color);
        }

        .trash-button:hover {
          background: var(--bg-color);
        }

        .trash-button:hover .button__text {
          color: transparent;
        }

        .trash-button:hover .button__icon {
          /* Was calc(100% - 4px) to clear the old 2px solid border. The
             border was removed when the button went neumorphic, so the
             icon strip should cover the full width on hover — otherwise
             a 4px sliver of the base background shows on the right edge. */
          width: 100%;
          transform: translateX(0);
        }

        .trash-button:active {
          box-shadow:
            inset 4px 4px 8px ${isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(55, 84, 170, 0.22)'},
            inset -4px -4px 10px ${isDark ? 'rgba(96, 120, 160, 0.3)' : 'rgba(255, 255, 255, 0.7)'};
        }
      `}} />
    </>
  );
}
