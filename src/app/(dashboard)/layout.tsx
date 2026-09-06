'use client';

import { useEffect } from 'react';
import localFont from 'next/font/local';
import { Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/sidebar-responsive';
import { BlurOverlay } from '@/components/blur-overlay';
import { Toaster } from '@/components/ui/sonner';
import { useAutoLock } from '@/hooks/use-auto-lock';
import { useSessionHeartbeat } from '@/hooks/use-session-heartbeat';
import { CompactProvider } from '@/contexts/compact-context';
import { ClipsProvider } from '@/contexts/clips-context';
import { GroupsProvider } from '@/contexts/groups-context';
import { subscribeToSignoutBroadcasts } from '@/lib/signout';

// Dashboard-only fonts, loaded here rather than the root layout so the
// login route (which pins its own separate font entirely) never
// downloads any of them. See root layout.tsx for the fuller rationale.
const generalSans = localFont({
  src: [
    { path: '../../fonts/general-sans/GeneralSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/general-sans/GeneralSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../fonts/general-sans/GeneralSans-Semibold.woff2', weight: '600', style: 'normal' },
    { path: '../../fonts/general-sans/GeneralSans-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-general-sans',
  display: 'swap',
});

const gambetta = localFont({
  src: [
    { path: '../../fonts/gambetta/Gambetta-Variable.woff2', weight: '300 700', style: 'normal' },
    { path: '../../fonts/gambetta/Gambetta-VariableItalic.woff2', weight: '300 700', style: 'italic' },
  ],
  variable: '--font-gambetta',
  display: 'swap',
});

const pilcrowRounded = localFont({
  src: [
    { path: '../../fonts/pilcrow-rounded/PilcrowRounded-Variable.woff2', weight: '400 900', style: 'normal' },
  ],
  variable: '--font-pilcrow-rounded',
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAutoLock(5);
  useSessionHeartbeat();

  // Listen for sign-out broadcasts from peer tabs (BroadcastChannel) — if
  // any other tab in the same browser signs out, this one jumps to /login
  // immediately instead of waiting for the next request to be 307'd.
  useEffect(() => subscribeToSignoutBroadcasts(), []);

  // Colors swapped: <main> now uses the swapped solid --background (was the
  // sidebar's tone), and <Sidebar> now paints the --surface-gradient (the
  // grey-to-blue-grey ramp that used to live here). Both defined in
  // globals.css per theme — no useTheme needed.
  return (
    <ClipsProvider>
      <GroupsProvider>
        <CompactProvider>
          {/* `contents` (display: contents) so this wrapper carries the font
              variables + the default body-font utility without adding a
              layout box of its own — the flex/height rules below still
              apply as if Sidebar/main were direct children of body. Wraps
              Toaster too: Sonner portals its toasts straight to
              document.body, outside the normal DOM tree, so it needs to be
              inside this scope to pick up the fonts rather than falling
              back to nothing (same lesson as the login page's Toaster). */}
          <div className={`${generalSans.variable} ${gambetta.variable} ${pilcrowRounded.variable} ${geistMono.variable} font-serif contents`}>
            <BlurOverlay>
              <div className="flex h-screen overflow-hidden">
                <Sidebar />
                {/* Theme toggle is no longer absolute-positioned here — each page
                    now renders it inline with its search bar / + button row, so
                    the three controls share the same baseline (no overlap, no
                    right-padding reserve). */}
                <main className="flex-1 overflow-auto w-full bg-background relative">
                  {children}
                </main>
              </div>
            </BlurOverlay>
            <Toaster position="bottom-right" />
          </div>
        </CompactProvider>
      </GroupsProvider>
    </ClipsProvider>
  );
}
