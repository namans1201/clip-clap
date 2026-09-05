'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar-responsive';
import { BlurOverlay } from '@/components/blur-overlay';
import { Toaster } from '@/components/ui/sonner';
import { useAutoLock } from '@/hooks/use-auto-lock';
import { useSessionHeartbeat } from '@/hooks/use-session-heartbeat';
import { CompactProvider } from '@/contexts/compact-context';
import { ClipsProvider } from '@/contexts/clips-context';
import { GroupsProvider } from '@/contexts/groups-context';
import { subscribeToSignoutBroadcasts } from '@/lib/signout';

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
        </CompactProvider>
      </GroupsProvider>
    </ClipsProvider>
  );
}
